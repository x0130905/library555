const fs = require('fs');
const path = require('path');
const { assertDeviceSession } = require('./session-utils');

exports.handler = async function handler(event, context) {
  const user = context.clientContext && context.clientContext.user;
  if (!user) {
    return json(401, { error: '请先登录。' });
  }

  const roles = getRoles(user);
  if (roles.length && !roles.some((role) => role === 'learner' || role === 'admin')) {
    return json(403, { error: '当前账号没有资料访问权限。' });
  }

  const deviceSession = await assertDeviceSession(event, user, context.clientContext && context.clientContext.identity);
  if (!deviceSession.ok) {
    return deviceSession.response;
  }

  const file = String(event.queryStringParameters?.file || '').trim();
  if (!file) {
    return json(400, { error: '缺少 PDF 文件名。' });
  }

  try {
    const baseDir = path.join(process.cwd(), 'public', 'pdfs');
    const fileName = decodeURIComponent(path.basename(file));
    if (!/^[^\\/]+\.pdf$/i.test(fileName)) {
      return json(400, { error: 'PDF 文件名不合法。' });
    }

    const filePath = path.join(baseDir, fileName);
    const resolvedBase = path.resolve(baseDir);
    const resolvedFile = path.resolve(filePath);

    if (!resolvedFile.startsWith(resolvedBase + path.sep)) {
      return json(400, { error: 'PDF 路径不合法。' });
    }

    const buffer = fs.readFileSync(resolvedFile);
    const header = buffer.subarray(0, 5).toString('utf8');
    const preview = buffer.subarray(0, 160).toString('utf8');

    if (preview.includes('version https://git-lfs.github.com/spec/v1')) {
      return json(422, {
        error: '读取到的是 Git LFS 指针文件，不是真实 PDF。请关闭 LFS 或把真实 PDF 文件提交到 public/pdfs/ 后重新部署。',
      });
    }

    if (header !== '%PDF-') {
      return json(422, {
        error: '读取到的不是有效 PDF 文件。请到 GitHub 的 public/pdfs/ 目录重新上传原始 PDF，不要通过后台文件控件上传。',
      });
    }

    return {
      statusCode: 200,
      isBase64Encoded: true,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
      },
      body: buffer.toString('base64'),
    };
  } catch (error) {
    return json(500, { error: `PDF 读取失败：${error.message}` });
  }
};

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
