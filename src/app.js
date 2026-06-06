(function () {
  const DATA_URL = '/.netlify/functions/pdf-data';
  const PDF_FILE_URL = '/.netlify/functions/pdf-file';
  const ADMIN_USERS_URL = '/.netlify/functions/admin-users';
  const DEVICE_SESSION_URL = '/.netlify/functions/device-session';
  const IDENTITY_WIDGET_URL = 'https://identity.netlify.com/v1/netlify-identity-widget.js';
  const PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const ALLOWED_ROLES = ['learner', 'admin'];
  const EMBEDDED_PDFS = [
    {
      id: 'design-system-guide',
      title: '设计系统入门指南',
      category: '理论力学',
      description: '介绍设计系统的基础概念、组件规范和团队协作流程，适合产品与设计团队共享阅读。',
      fileUrl: 'public/pdfs/design-system-guide.pdf',
      uploadDate: '2026-05-12',
      size: '1.2 MB',
      tags: ['设计系统', '组件', '协作'],
    },
    {
      id: 'frontend-checklist',
      title: '前端上线检查清单',
      category: '大学物理',
      description: '整理静态网站上线前需要确认的性能、可访问性、SEO、缓存和部署配置事项。',
      fileUrl: 'public/pdfs/frontend-checklist.pdf',
      uploadDate: '2026-05-28',
      size: '860 KB',
      tags: ['前端', '部署', 'Netlify'],
    },
    {
      id: 'research-summary',
      title: '用户研究摘要模板',
      category: '高等数学',
      description: '用于沉淀访谈结论、核心洞察、机会点和后续行动计划的 PDF 模板示例。',
      fileUrl: 'public/pdfs/research-summary.pdf',
      uploadDate: '2026-04-18',
      size: '540 KB',
      tags: ['用户研究', '模板', '报告'],
    },
    {
      id: '111',
      title: '5555',
      category: '理论力学',
      description: '这份资料的简短说明。',
      fileUrl: 'public/pdfs/111.pdf',
      uploadDate: '2026-06-03',
      size: '2.4 MB',
      tags: ['标签一', '标签二'],
    },
    {
      id: '第5章热力学基础',
      title: '前端上线检查清单',
      category: '大学物理',
      description: '整理静态网站上线前需要确认的性能、可访问性、SEO、缓存和部署配置事项。',
      fileUrl: 'public/pdfs/第5章热力学基础.pdf',
      uploadDate: '2026-05-28',
      size: '860 KB',
      tags: ['前端', '部署', 'Netlify'],
    },
  ];
  let identityLoadPromise = null;
  let identityHandlersBound = false;
  let pdfJsLoadPromise = null;
  let activePdfRenderId = 0;
  let activePdfObjectUrl = '';
  let deviceSessionTimer = null;
  let deviceSessionCheckPromise = null;
  let forcedLogoutMessage = '';

  const elements = {
    authView: document.querySelector('#authView'),
    appView: document.querySelector('#appView'),
    loginButton: document.querySelector('#loginButton'),
    loginHeroButton: document.querySelector('#loginHeroButton'),
    acceptInviteButton: document.querySelector('#acceptInviteButton'),
    inviteHeroButton: document.querySelector('#inviteHeroButton'),
    inviteDialog: document.querySelector('#inviteDialog'),
    closeInviteDialog: document.querySelector('#closeInviteDialog'),
    inviteForm: document.querySelector('#inviteForm'),
    inviteLinkInput: document.querySelector('#inviteLinkInput'),
    inviteTokenInput: document.querySelector('#inviteTokenInput'),
    invitePassword: document.querySelector('#invitePassword'),
    invitePasswordConfirm: document.querySelector('#invitePasswordConfirm'),
    inviteStatus: document.querySelector('#inviteStatus'),
    authStatus: document.querySelector('#authStatus'),
    logoutButton: document.querySelector('#logoutButton'),
    userEmail: document.querySelector('#userEmail'),
    roleBadge: document.querySelector('#roleBadge'),
    userAdminButton: document.querySelector('#userAdminButton'),
    contentAdminLink: document.querySelector('#contentAdminLink'),
    userAdminPanel: document.querySelector('#userAdminPanel'),
    closeUserAdmin: document.querySelector('#closeUserAdmin'),
    inviteUserForm: document.querySelector('#inviteUserForm'),
    inviteEmail: document.querySelector('#inviteEmail'),
    inviteRole: document.querySelector('#inviteRole'),
    refreshUsers: document.querySelector('#refreshUsers'),
    userList: document.querySelector('#userList'),
    userAdminStatus: document.querySelector('#userAdminStatus'),
    totalCount: document.querySelector('#totalCount'),
    categoryCount: document.querySelector('#categoryCount'),
    categoryList: document.querySelector('#categoryList'),
    searchInput: document.querySelector('#searchInput'),
    pdfGrid: document.querySelector('#pdfGrid'),
    emptyState: document.querySelector('#emptyState'),
    resultSummary: document.querySelector('#resultSummary'),
    libraryTitle: document.querySelector('#libraryTitle'),
    viewerPanel: document.querySelector('#viewerPanel'),
    viewerTitle: document.querySelector('#viewerTitle'),
    viewerMeta: document.querySelector('#viewerMeta'),
    pdfViewer: document.querySelector('#pdfViewer'),
    fullscreenViewer: document.querySelector('#fullscreenViewer'),
    closeViewer: document.querySelector('#closeViewer'),
  };

  const state = {
    pdfs: [],
    category: getCategoryFromUrl(),
    query: '',
    user: null,
    roles: [],
    dataLoaded: false,
    deviceSessionId: '',
  };

  init();

  function init() {
    bindEvents();
    prefillInviteFromUrl();
    scheduleIdentityInit();
  }

  function bindEvents() {
    elements.loginButton.addEventListener('click', openLogin);
    elements.loginHeroButton.addEventListener('click', openLogin);
    elements.acceptInviteButton.addEventListener('click', () => openInviteDialog());
    elements.inviteHeroButton.addEventListener('click', () => openInviteDialog());
    elements.closeInviteDialog.addEventListener('click', closeInviteDialog);

    elements.inviteLinkInput.addEventListener('input', () => {
      const token = extractInviteToken(elements.inviteLinkInput.value);
      if (token) {
        elements.inviteTokenInput.value = token;
      }
    });

    elements.inviteForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await acceptInvite();
    });

    elements.logoutButton.addEventListener('click', async () => {
      await releaseDeviceSession();
      if (window.netlifyIdentity) {
        window.netlifyIdentity.logout();
      }
    });

    elements.userAdminButton.addEventListener('click', async () => {
      const shouldOpen = elements.userAdminPanel.hidden;
      elements.userAdminPanel.hidden = !shouldOpen;
      if (shouldOpen) {
        await loadUsers();
        elements.userAdminPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    elements.closeUserAdmin.addEventListener('click', () => {
      elements.userAdminPanel.hidden = true;
    });

    elements.inviteUserForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await inviteUser();
    });

    elements.refreshUsers.addEventListener('click', loadUsers);

    elements.userList.addEventListener('change', async (event) => {
      if (event.target.matches('[data-role-select]')) {
        await updateUserRole(event.target.dataset.userId, event.target.value);
      }
    });

    elements.userList.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-delete-user]');
      if (button) {
        await deleteUser(button.dataset.deleteUser);
      }
    });

    elements.searchInput.addEventListener('input', (event) => {
      state.query = event.target.value.trim().toLowerCase();
      renderPdfList();
    });

    elements.pdfGrid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-preview-id]');
      if (button) {
        const pdf = state.pdfs.find((item) => item.id === button.dataset.previewId);
        if (pdf) openViewer(pdf);
      }
    });

    elements.closeViewer.addEventListener('click', closeViewer);
    elements.fullscreenViewer.addEventListener('click', toggleViewerFullscreen);

    document.addEventListener('fullscreenchange', syncFullscreenButton);
    document.addEventListener('webkitfullscreenchange', syncFullscreenButton);

    window.addEventListener('popstate', () => {
      state.category = getCategoryFromUrl();
      render();
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && state.user) {
        checkDeviceSession();
      }
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeInviteDialog();
        exitViewerFullscreen();
        closeViewer();
        elements.userAdminPanel.hidden = true;
      }
    });
  }

  function scheduleIdentityInit() {
    const start = () => {
      initIdentity();
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(start, { timeout: 650 });
    } else {
      window.setTimeout(start, 250);
    }
  }

  async function initIdentity() {
    try {
      const identity = await ensureIdentityWidget();
      bindIdentityHandlers(identity);
      identity.init();
    } catch {
      showLoggedOut('请部署到 Netlify 并启用 Identity 后使用邀请登录。本地预览只能查看界面。');
    }
  }

  function ensureIdentityWidget() {
    if (window.netlifyIdentity) {
      return Promise.resolve(window.netlifyIdentity);
    }

    if (identityLoadPromise) {
      return identityLoadPromise;
    }

    identityLoadPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${IDENTITY_WIDGET_URL}"]`);
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.netlifyIdentity));
        existingScript.addEventListener('error', reject);
        return;
      }

      const script = document.createElement('script');
      script.src = IDENTITY_WIDGET_URL;
      script.async = true;
      script.onload = () => {
        if (window.netlifyIdentity) {
          resolve(window.netlifyIdentity);
        } else {
          reject(new Error('Netlify Identity 加载失败。'));
        }
      };
      script.onerror = () => reject(new Error('Netlify Identity 加载失败。'));
      document.head.appendChild(script);
    });

    return identityLoadPromise;
  }

  function bindIdentityHandlers(identity) {
    if (identityHandlersBound) return;
    identityHandlersBound = true;

    identity.on('init', handleIdentityUser);
    identity.on('login', (user) => {
      identity.close();
      handleIdentityUser(user);
    });
    identity.on('logout', () => {
      stopDeviceSessionMonitor();
      state.user = null;
      state.roles = [];
      state.dataLoaded = false;
      state.pdfs = [];
      state.deviceSessionId = '';
      closeViewer();
      showLoggedOut(forcedLogoutMessage || '已退出登录。');
      forcedLogoutMessage = '';
    });
    identity.on('error', (error) => {
      setStatus(elements.authStatus, `登录服务提示：${error.message}`, 'error');
    });
  }

  async function handleIdentityUser(user) {
    if (!user) {
      showLoggedOut('请登录；如果你是第一次进入，请先在“接受邀请 / 设置密码”处完成账号设置。');
      return;
    }

    state.user = user;
    state.roles = getEffectiveRoles(user);
    const isAllowed = state.roles.some((role) => ALLOWED_ROLES.includes(role));

    if (!isAllowed) {
      showLoggedOut('账号已登录，但暂未分配 learner 或 admin 角色。请联系管理员开通权限。');
      return;
    }

    elements.authView.hidden = true;
    elements.appView.hidden = false;
    elements.userEmail.textContent = user.email || '已登录用户';
    elements.roleBadge.textContent = state.roles.includes('admin') ? 'admin' : 'learner';
    const isAdmin = state.roles.includes('admin');
    elements.userAdminButton.hidden = !isAdmin;
    elements.contentAdminLink.hidden = !isAdmin;
    elements.userAdminPanel.hidden = true;

    try {
      await registerDeviceSession(user);
      startDeviceSessionMonitor();
    } catch (error) {
      showLoggedOut(error.message || '设备登录校验失败，请稍后重试。');
      return;
    }

    if (!state.dataLoaded) {
      await loadPdfData();
    }
    render();
  }

  function showLoggedOut(message) {
    elements.authView.hidden = false;
    elements.appView.hidden = true;
    elements.userAdminPanel.hidden = true;
    setStatus(elements.authStatus, message, 'info');
  }

  async function loadPdfData() {
    try {
      const response = await authFetch(`${DATA_URL}?v=${Date.now()}`);
      if (!response.ok) {
        throw new Error('资料清单读取失败。');
      }

      const payload = await response.json();
      state.pdfs = normalizePdfData(payload);
      state.dataLoaded = true;
    } catch {
      state.pdfs = normalizePdfData({ pdfs: EMBEDDED_PDFS });
      state.dataLoaded = true;
    }
  }

  function normalizePdfData(payload) {
    const source = Array.isArray(payload) ? payload : payload?.pdfs;
    if (!Array.isArray(source)) {
      return [];
    }

    return source
      .filter((pdf) => pdf && typeof pdf === 'object')
      .map((pdf) => ({
        id: String(pdf.id || '').trim(),
        title: String(pdf.title || '').trim(),
        category: String(pdf.category || '').trim(),
        description: String(pdf.description || '').trim(),
        fileUrl: normalizePdfFileUrl(pdf.fileUrl),
        uploadDate: String(pdf.uploadDate || '').trim(),
        size: String(pdf.size || '').trim(),
        tags: Array.isArray(pdf.tags) ? pdf.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
      }))
      .filter((pdf) => pdf.id && pdf.fileUrl);
  }

  function normalizePdfFileUrl(fileUrl) {
    const value = String(fileUrl || '').trim();
    if (!value) return '';
    return value.replace(/^\/+/, '');
  }

  async function openLogin() {
    try {
      const identity = await ensureIdentityWidget();
      bindIdentityHandlers(identity);
      identity.open('login');
    } catch {
      setStatus(elements.authStatus, '请先部署到 Netlify，并启用 Identity。', 'error');
    }
  }

  async function openSignup() {
    try {
      const identity = await ensureIdentityWidget();
      bindIdentityHandlers(identity);
      identity.open('signup');
    } catch {
      setStatus(elements.authStatus, '请先部署到 Netlify，并启用 Identity。', 'error');
    }
  }

  function openInviteDialog(message) {
    elements.inviteDialog.hidden = false;
    if (message) {
      setStatus(elements.inviteStatus, message, 'info');
    } else if (!elements.inviteStatus.textContent) {
      setStatus(elements.inviteStatus, '粘贴邀请链接后，系统会自动识别邀请码。', 'info');
    }
    setTimeout(() => {
      const target = elements.inviteTokenInput.value ? elements.invitePassword : elements.inviteLinkInput;
      target.focus();
    }, 0);
  }

  function closeInviteDialog() {
    elements.inviteDialog.hidden = true;
  }

  function prefillInviteFromUrl() {
    const token = extractInviteToken(window.location.href);
    if (token) {
      elements.inviteLinkInput.value = window.location.href;
      elements.inviteTokenInput.value = token;
      clearInviteTokenFromUrl();
      openInviteDialog('已从邀请链接识别到邀请码，请设置密码完成注册。');
    }
  }

  async function acceptInvite() {
    const linkToken = extractInviteToken(elements.inviteLinkInput.value);
    const token = elements.inviteTokenInput.value.trim() || linkToken;
    const password = elements.invitePassword.value;
    const passwordConfirm = elements.invitePasswordConfirm.value;

    if (!token) {
      setStatus(elements.inviteStatus, '请粘贴邀请邮件链接，或填写邀请码。', 'error');
      return;
    }

    if (!password || password.length < 6) {
      setStatus(elements.inviteStatus, '请设置至少 6 位密码。', 'error');
      return;
    }

    if (password !== passwordConfirm) {
      setStatus(elements.inviteStatus, '两次输入的密码不一致。', 'error');
      return;
    }

    setStatus(elements.inviteStatus, '正在设置密码并完成注册...', 'info');

    try {
      await acceptInviteWithApi(token, password);
      elements.inviteForm.reset();
      closeInviteDialog();
      clearInviteTokenFromUrl();
      setStatus(elements.authStatus, '密码设置完成，请点击登录，并使用刚设置的密码进入资料库。', 'success');
      await openLogin();
    } catch (error) {
      setStatus(elements.inviteStatus, normalizeIdentityError(error), 'error');
    }
  }

  async function acceptInviteWithApi(token, password) {
    const response = await fetch('/.netlify/identity/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token,
        type: 'signup',
        password,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.msg || data.error || data.message || '邀请验证失败。');
      error.json = data;
      throw error;
    }

    return data;
  }

  function render() {
    const categories = getCategories();
    elements.totalCount.textContent = state.pdfs.length;
    elements.categoryCount.textContent = categories.length;
    renderCategories(categories);
    renderPdfList();
  }

  function renderCategories(categories) {
    const allCount = state.pdfs.length;
    const buttons = [
      createCategoryButton('全部', '', allCount),
      ...categories.map((category) => {
        const count = state.pdfs.filter((pdf) => pdf.category === category).length;
        return createCategoryButton(category, category, count);
      }),
    ];

    elements.categoryList.replaceChildren(...buttons);
  }

  function createCategoryButton(label, value, count) {
    const button = document.createElement('button');
    const isActive = state.category === value || (!state.category && !value);
    button.className = isActive ? 'category-button active' : 'category-button';
    button.type = 'button';
    button.dataset.category = value;
    button.innerHTML = `<span>${escapeHtml(label)}</span><strong>${count}</strong>`;
    button.addEventListener('click', () => {
      state.category = value;
      updateUrlCategory(value);
      render();
    });
    return button;
  }

  function renderPdfList() {
    const filtered = getFilteredPdfs();
    const categoryName = state.category || '全部资料';
    elements.libraryTitle.textContent = categoryName;
    elements.resultSummary.textContent = buildSummary(filtered.length);
    elements.emptyState.hidden = filtered.length > 0;

    elements.pdfGrid.replaceChildren(...filtered.map(createPdfCard));
  }

  function createPdfCard(pdf) {
    const article = document.createElement('article');
    article.className = 'pdf-card';
    const tags = Array.isArray(pdf.tags) ? pdf.tags : [];

    article.innerHTML = `
      <div class="card-top">
        <span class="file-badge">PDF</span>
        <span class="category-pill">${escapeHtml(pdf.category || '未分类')}</span>
      </div>
      <h3>${escapeHtml(pdf.title || '未命名资料')}</h3>
      <p class="description">${escapeHtml(pdf.description || '暂无简介')}</p>
      <dl class="meta-list">
        <div>
          <dt>上传时间</dt>
          <dd>${formatDate(pdf.uploadDate)}</dd>
        </div>
        <div>
          <dt>文件大小</dt>
          <dd>${escapeHtml(pdf.size || '未知')}</dd>
        </div>
      </dl>
      <div class="tag-list">
        ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
      </div>
      <div class="card-actions">
        <button class="button primary" type="button" data-preview-id="${escapeAttribute(pdf.id)}">在线查看</button>
      </div>
    `;

    return article;
  }

  function openViewer(pdf) {
    elements.viewerPanel.hidden = false;
    elements.viewerPanel.classList.remove('fullscreen-fallback');
    elements.viewerTitle.textContent = pdf.title || '在线查看';
    elements.viewerMeta.textContent = `${pdf.category || '未分类'} / ${formatDate(pdf.uploadDate)} / ${pdf.size || '未知大小'}`;
    renderPdfInViewer(pdf);
    syncFullscreenButton();
    elements.viewerPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeViewer() {
    exitViewerFullscreen();
    elements.viewerPanel.hidden = true;
    activePdfRenderId += 1;
    revokeActivePdfObjectUrl();
    elements.pdfViewer.replaceChildren();
  }

  async function renderPdfInViewer(pdf) {
    const renderId = (activePdfRenderId += 1);
    revokeActivePdfObjectUrl();
    elements.pdfViewer.replaceChildren(createViewerMessage('正在载入 PDF...'));

    try {
      const fileName = getPdfFileName(pdf);
      const response = await authFetch(`${PDF_FILE_URL}?file=${encodeURIComponent(fileName)}`);
      if (!response.ok) {
        throw new Error('无法读取 PDF 文件，请确认账号权限。');
      }

      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      try {
        await renderPdfWithPdfJs(bytes, renderId);
      } catch (pdfError) {
        if (renderId !== activePdfRenderId) return;
        renderPdfWithBrowserFallback(bytes, pdf);
      }
    } catch (error) {
      if (renderId !== activePdfRenderId) return;
      elements.pdfViewer.replaceChildren(createViewerMessage(error.message || 'PDF 载入失败，请稍后重试。', true));
    }
  }

  async function renderPdfWithPdfJs(bytes, renderId) {
    const pdfjsLib = await ensurePdfJs();
    const documentTask = pdfjsLib.getDocument({
      data: bytes.slice(),
      stopAtErrors: false,
      isEvalSupported: false,
    });
    const pdfDocument = await documentTask.promise;

    if (renderId !== activePdfRenderId) return;
    elements.pdfViewer.replaceChildren();

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      if (renderId !== activePdfRenderId) return;
      const page = await pdfDocument.getPage(pageNumber);
      const containerWidth = Math.min(elements.pdfViewer.clientWidth || 960, 1120);
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.max(0.8, Math.min(2.2, (containerWidth - 28) / baseViewport.width));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.className = 'pdf-page-canvas';
      canvas.setAttribute('aria-label', `第 ${pageNumber} 页`);
      elements.pdfViewer.appendChild(canvas);
      await page.render({ canvasContext: context, viewport }).promise;
    }
  }

  function renderPdfWithBrowserFallback(bytes, pdf) {
    revokeActivePdfObjectUrl();
    activePdfObjectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    if (!elements.viewerMeta.textContent.includes('兼容预览')) {
      elements.viewerMeta.textContent = `${elements.viewerMeta.textContent} / 兼容预览`;
    }

    const iframe = document.createElement('iframe');
    iframe.className = 'pdf-fallback-frame';
    iframe.title = `${pdf.title || 'PDF'} 兼容预览`;
    iframe.src = `${activePdfObjectUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`;

    elements.pdfViewer.replaceChildren(iframe);
  }

  function revokeActivePdfObjectUrl() {
    if (activePdfObjectUrl) {
      URL.revokeObjectURL(activePdfObjectUrl);
      activePdfObjectUrl = '';
    }
  }

  function createViewerMessage(message, isError) {
    const paragraph = document.createElement('p');
    paragraph.className = isError ? 'viewer-message error' : 'viewer-message';
    paragraph.textContent = message;
    return paragraph;
  }

  function ensurePdfJs() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return Promise.resolve(window.pdfjsLib);
    }

    if (pdfJsLoadPromise) {
      return pdfJsLoadPromise;
    }

    pdfJsLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PDFJS_URL;
      script.async = true;
      script.onload = () => {
        if (!window.pdfjsLib) {
          reject(new Error('PDF 查看器加载失败。'));
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        resolve(window.pdfjsLib);
      };
      script.onerror = () => reject(new Error('PDF 查看器加载失败，请检查网络。'));
      document.head.appendChild(script);
    });

    return pdfJsLoadPromise;
  }

  async function toggleViewerFullscreen() {
    if (isViewerFullscreen()) {
      await exitViewerFullscreen();
      return;
    }

    const panel = elements.viewerPanel;
    const requestFullscreen =
      panel.requestFullscreen ||
      panel.webkitRequestFullscreen ||
      panel.msRequestFullscreen;

    if (requestFullscreen) {
      try {
        await requestFullscreen.call(panel);
        syncFullscreenButton();
        return;
      } catch {
        // Fall back to page-level fullscreen style below.
      }
    }

    panel.classList.add('fullscreen-fallback');
    syncFullscreenButton();
  }

  async function exitViewerFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      const exitFullscreen =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.msExitFullscreen;
      if (exitFullscreen) {
        try {
          await exitFullscreen.call(document);
        } catch {
          // Ignore browser-specific fullscreen exit failures.
        }
      }
    }

    elements.viewerPanel.classList.remove('fullscreen-fallback');
    syncFullscreenButton();
  }

  function isViewerFullscreen() {
    return (
      document.fullscreenElement === elements.viewerPanel ||
      document.webkitFullscreenElement === elements.viewerPanel ||
      elements.viewerPanel.classList.contains('fullscreen-fallback')
    );
  }

  function syncFullscreenButton() {
    elements.fullscreenViewer.textContent = isViewerFullscreen() ? '退出全屏' : '全屏查看';
  }

  async function loadUsers() {
    if (!state.roles.includes('admin')) return;
    setStatus(elements.userAdminStatus, '正在读取用户列表...', 'info');

    try {
      const data = await adminRequest('GET');
      renderUsers(data.users || []);
      setStatus(elements.userAdminStatus, `已读取 ${data.users?.length || 0} 个用户。`, 'success');
    } catch (error) {
      renderUsers([]);
      setStatus(elements.userAdminStatus, error.message, 'error');
    }
  }

  async function inviteUser() {
    const email = elements.inviteEmail.value.trim();
    const role = elements.inviteRole.value;
    if (!email) return;

    setStatus(elements.userAdminStatus, '正在发送邀请...', 'info');

    try {
      await adminRequest('POST', { email, role });
      elements.inviteUserForm.reset();
      setStatus(elements.userAdminStatus, `已向 ${email} 发送邀请。`, 'success');
      await loadUsers();
    } catch (error) {
      setStatus(elements.userAdminStatus, error.message, 'error');
    }
  }

  async function updateUserRole(id, role) {
    setStatus(elements.userAdminStatus, '正在保存用户角色...', 'info');

    try {
      await adminRequest('PATCH', { id, role });
      setStatus(elements.userAdminStatus, '用户角色已更新。', 'success');
      await loadUsers();
    } catch (error) {
      setStatus(elements.userAdminStatus, error.message, 'error');
    }
  }

  async function deleteUser(id) {
    setStatus(elements.userAdminStatus, '正在移除用户...', 'info');

    try {
      await adminRequest('DELETE', { id });
      setStatus(elements.userAdminStatus, '用户已移除。', 'success');
      await loadUsers();
    } catch (error) {
      setStatus(elements.userAdminStatus, error.message, 'error');
    }
  }

  async function adminRequest(method, body) {
    const token = await state.user.jwt();
    const response = await fetch(ADMIN_USERS_URL, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Device-Session': state.deviceSessionId,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || '用户管理请求失败。');
    }
    return data;
  }

  function renderUsers(users) {
    if (!users.length) {
      elements.userList.innerHTML = '<p class="muted">暂无用户，或当前无法读取用户列表。</p>';
      return;
    }

    elements.userList.replaceChildren(
      ...users.map((user) => {
        const row = document.createElement('article');
        row.className = 'user-row';
        const role = getRoles(user).includes('admin') ? 'admin' : 'learner';
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(user.email || '未命名用户')}</strong>
            <span>${escapeHtml(user.id || '')}</span>
          </div>
          <select data-role-select data-user-id="${escapeAttribute(user.id)}">
            <option value="learner" ${role === 'learner' ? 'selected' : ''}>learner</option>
            <option value="admin" ${role === 'admin' ? 'selected' : ''}>admin</option>
          </select>
          <button class="button secondary compact" type="button" data-delete-user="${escapeAttribute(user.id)}">移除</button>
        `;
        return row;
      })
    );
  }

  function getFilteredPdfs() {
    return state.pdfs
      .filter((pdf) => !state.category || pdf.category === state.category)
      .filter((pdf) => {
        if (!state.query) return true;
        const haystack = [
          pdf.title,
          pdf.category,
          pdf.description,
          ...(Array.isArray(pdf.tags) ? pdf.tags : []),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(state.query);
      })
      .sort((a, b) => new Date(b.uploadDate || 0) - new Date(a.uploadDate || 0));
  }

  function getCategories() {
    return [...new Set(state.pdfs.map((pdf) => pdf.category).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'zh-CN')
    );
  }

  function getRoles(user) {
    const roles =
      user?.app_metadata?.roles ||
      user?.app_metadata?.authorization?.roles ||
      user?.user_metadata?.roles ||
      [];
    return Array.isArray(roles) ? roles : [];
  }

  function getEffectiveRoles(user) {
    const roles = getRoles(user);
    return roles.length ? roles : ['learner'];
  }

  async function authFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    if (state.user && typeof state.user.jwt === 'function') {
      try {
        headers.set('Authorization', `Bearer ${await state.user.jwt()}`);
      } catch {
        // Continue without a token; Netlify will reject protected resources.
      }
    }
    if (state.deviceSessionId) {
      headers.set('X-Device-Session', state.deviceSessionId);
    }
    const response = await fetch(url, { ...options, headers });
    if (response.status === 409 && url !== DEVICE_SESSION_URL) {
      forceLogoutForDeviceConflict();
    }
    return response;
  }

  function getDeviceSessionId(user) {
    const userId = user?.sub || user?.id || user?.email || 'unknown-user';
    const key = `pdf-library-device-session:${userId}`;
    let sessionId = localStorage.getItem(key);
    if (!sessionId) {
      sessionId = createSessionId();
      localStorage.setItem(key, sessionId);
    }
    return sessionId;
  }

  function createSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
      .toString(36)
      .slice(2)}`;
  }

  async function registerDeviceSession(user) {
    state.deviceSessionId = getDeviceSessionId(user);
    await sendDeviceSessionRequest('register');
  }

  function startDeviceSessionMonitor() {
    stopDeviceSessionMonitor();
    deviceSessionTimer = window.setInterval(checkDeviceSession, 30000);
  }

  function stopDeviceSessionMonitor() {
    if (deviceSessionTimer) {
      window.clearInterval(deviceSessionTimer);
      deviceSessionTimer = null;
    }
    deviceSessionCheckPromise = null;
  }

  async function checkDeviceSession() {
    if (!state.user || !state.deviceSessionId || deviceSessionCheckPromise) return;

    deviceSessionCheckPromise = sendDeviceSessionRequest('check')
      .catch((error) => {
        if (error.status === 409) {
          forceLogoutForDeviceConflict();
        }
      })
      .finally(() => {
        deviceSessionCheckPromise = null;
      });

    await deviceSessionCheckPromise;
  }

  async function releaseDeviceSession() {
    if (!state.user || !state.deviceSessionId) return;
    try {
      await sendDeviceSessionRequest('logout');
    } catch {
      // Logging out locally should still work if the network request fails.
    }
  }

  async function sendDeviceSessionRequest(action) {
    const token = await state.user.jwt();
    let response;
    let data = {};

    try {
      response = await fetch(DEVICE_SESSION_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          sessionId: state.deviceSessionId,
        }),
      });
      data = await response.json().catch(() => ({}));
    } catch (error) {
      console.warn('Device session service is unavailable.', error);
      return { active: true, limited: false };
    }

    if (!response.ok) {
      const error = new Error(data.error || '设备会话校验失败。');
      error.status = response.status;
      if (response.status !== 409) {
        console.warn('Device session check was skipped.', error);
        return { active: true, limited: false };
      }
      throw error;
    }
    return data;
  }

  function forceLogoutForDeviceConflict() {
    forcedLogoutMessage = '该账号已在另一台设备登录，本设备已自动退出。';
    stopDeviceSessionMonitor();
    if (window.netlifyIdentity) {
      window.netlifyIdentity.logout();
    } else {
      showLoggedOut(forcedLogoutMessage);
      forcedLogoutMessage = '';
    }
  }

  function getCategoryFromUrl() {
    return new URLSearchParams(window.location.search).get('category') || '';
  }

  function extractInviteToken(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    try {
      const url = new URL(raw, window.location.origin);
      const searchToken = getTokenFromParams(url.searchParams);
      if (searchToken) return searchToken;

      const hash = url.hash.replace(/^#\/?/, '');
      const hashToken = getTokenFromParams(new URLSearchParams(hash));
      if (hashToken) return hashToken;
    } catch {
      // Fall through and try plain-text extraction below.
    }

    const match = raw.match(/(?:invite_token|confirmation_token|token)=([^&#\s]+)/);
    if (match) return decodeURIComponent(match[1]);

    if (/^[A-Za-z0-9._~+/=-]{16,}$/.test(raw)) {
      return raw;
    }

    return '';
  }

  function getTokenFromParams(params) {
    return (
      params.get('invite_token') ||
      params.get('confirmation_token') ||
      params.get('token') ||
      ''
    ).trim();
  }

  function clearInviteTokenFromUrl() {
    const url = new URL(window.location.href);
    url.hash = '';
    url.searchParams.delete('invite_token');
    url.searchParams.delete('confirmation_token');
    url.searchParams.delete('token');
    window.history.replaceState({}, '', url);
  }

  function updateUrlCategory(category) {
    const url = new URL(window.location.href);
    if (category) {
      url.searchParams.set('category', category);
    } else {
      url.searchParams.delete('category');
    }
    window.history.pushState({}, '', url);
  }

  function buildSummary(count) {
    const pieces = [`共 ${count} 份资料`];
    if (state.category) pieces.push(`分类：${state.category}`);
    if (state.query) pieces.push(`搜索：${state.query}`);
    return pieces.join(' / ');
  }

  function formatDate(value) {
    if (!value) return '未知';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  function setStatus(element, message, type) {
    element.textContent = message;
    element.dataset.type = type;
  }

  function normalizeIdentityError(error) {
    const message = error?.json?.msg || error?.message || '邀请验证失败，请确认链接或邀请码是否完整。';
    if (/invalid|expired|not found/i.test(message)) {
      return '邀请链接无效或已过期，请联系管理员重新发送邀请。';
    }
    if (/password/i.test(message)) {
      return '密码不符合要求，请换一个更安全的密码。';
    }
    return message;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value || '');
  }

  function getPdfFileName(pdf) {
    const fileUrl = String(pdf?.fileUrl || '');
    const fileName = decodeURIComponent(fileUrl.split('/').pop() || '');
    if (!fileName || !/\.pdf$/i.test(fileName)) {
      throw new Error('PDF 文件地址格式不正确。');
    }
    return fileName;
  }
})();
