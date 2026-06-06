const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const TOUCH_INTERVAL_MS = 1000 * 60 * 5;
const DEVICE_META_KEY = 'pdfLibraryDeviceSession';

exports.handler = async function handler(event, context) {
  const user = context.clientContext && context.clientContext.user;
  const identity = context.clientContext && context.clientContext.identity;

  if (!user) {
    return json(401, { error: '请先登录。' });
  }

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: '请求格式不正确。' });
  }

  const action = String(payload.action || '').trim();
  const sessionId = String(payload.sessionId || '').trim();

  if (!sessionId || !/^[a-zA-Z0-9._:-]{12,160}$/.test(sessionId)) {
    return json(400, { error: '设备会话无效。' });
  }

  if (!['register', 'check', 'logout'].includes(action)) {
    return json(400, { error: '未知设备会话操作。' });
  }

  const userId = getUserId(user);
  if (!identity || !identity.url || !identity.token || !userId) {
    return json(200, { active: true, limited: false, warning: '设备会话服务暂时不可用。' });
  }

  try {
    const freshUser = await getIdentityUser(identity, userId);
    const appMetadata = {
      ...(freshUser.app_metadata || {}),
      ...(freshUser.app_metadata?.roles ? {} : { roles: getRoles(user) }),
    };
    const current = appMetadata[DEVICE_META_KEY];
    const now = Date.now();
    const expired = isExpired(current, now);

    if (action === 'register') {
      appMetadata[DEVICE_META_KEY] = createRecord(sessionId, user, event, now);
      await updateIdentityUser(identity, userId, appMetadata);
      return json(200, { active: true, limited: true });
    }

    if (action === 'logout') {
      return json(200, { active: false, limited: true });
    }

    if (!current || expired) {
      appMetadata[DEVICE_META_KEY] = createRecord(sessionId, user, event, now);
      await updateIdentityUser(identity, userId, appMetadata);
      return json(200, { active: true, limited: true });
    }

    if (current.sessionId !== sessionId) {
      return json(409, { active: false, error: '该账号已在另一台设备登录。' });
    }

    if (now - Number(current.updatedAt || 0) > TOUCH_INTERVAL_MS) {
      appMetadata[DEVICE_META_KEY] = { ...current, updatedAt: now };
      await updateIdentityUser(identity, userId, appMetadata);
    }

    return json(200, { active: true, limited: true });
  } catch (error) {
    console.error('device-session failed', error);
    return json(200, {
      active: true,
      limited: false,
      warning: '设备会话服务暂时不可用，已允许当前登录继续。',
    });
  }
};

async function getIdentityUser(identity, userId) {
  return identityRequest(identity, `/admin/users/${encodeURIComponent(userId)}`, {
    method: 'GET',
  });
}

async function updateIdentityUser(identity, userId, appMetadata) {
  return identityRequest(identity, `/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: JSON.stringify({ app_metadata: appMetadata }),
  });
}

async function identityRequest(identity, path, options) {
  const response = await fetch(`${identity.url}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${identity.token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const error = new Error(data.msg || data.error || data.message || 'Netlify Identity 请求失败。');
    error.status = response.status;
    throw error;
  }

  return data;
}

function createRecord(sessionId, user, event, now) {
  return {
    sessionId,
    email: user.email || '',
    userAgent: event.headers['user-agent'] || '',
    updatedAt: now,
  };
}

function isExpired(record, now) {
  return record && now - Number(record.updatedAt || 0) > SESSION_TTL_MS;
}

function getUserId(user) {
  return user.sub || user.id || '';
}

function getRoles(user) {
  const roles =
    user?.app_metadata?.roles ||
    user?.app_metadata?.authorization?.roles ||
    user?.user_metadata?.roles ||
    [];
  return Array.isArray(roles) ? roles : [];
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}
