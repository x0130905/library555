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

  try {
    const dataPath = path.join(process.cwd(), 'data', 'pdfs.json');
    const payload = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const pdfs = normalizePdfData(payload);
    return json(200, { pdfs });
  } catch (error) {
    return json(500, { error: `资料清单读取失败：${error.message}` });
  }
};

function normalizePdfData(payload) {
  const source = Array.isArray(payload) ? payload : payload && payload.pdfs;
  if (!Array.isArray(source)) return [];

  return source
    .filter((pdf) => pdf && typeof pdf === 'object')
    .map((pdf) => ({
      id: String(pdf.id || '').trim(),
      title: String(pdf.title || '').trim(),
      category: String(pdf.category || '').trim(),
      description: String(pdf.description || '').trim(),
      fileUrl: String(pdf.fileUrl || '').trim().replace(/^\/+/, ''),
      uploadDate: String(pdf.uploadDate || '').trim(),
      size: String(pdf.size || '').trim(),
      tags: Array.isArray(pdf.tags) ? pdf.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    }))
    .filter((pdf) => pdf.id && pdf.fileUrl);
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
      'Cache-Control': 'private, no-store',
    },
    body: JSON.stringify(body),
  };
}
