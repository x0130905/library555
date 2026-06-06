const { assertDeviceSession } = require('./session-utils');

exports.handler = async function handler(event, context) {
  const clientContext = context.clientContext || {};
  const currentUser = clientContext.user;
  const identity = clientContext.identity;

  if (!currentUser || !identity) {
    return json(401, { error: '请先登录。' });
  }

  const roles = getRoles(currentUser);
  if (!roles.includes('admin')) {
    return json(403, { error: '只有 admin 用户可以管理用户。' });
  }

  const deviceSession = await assertDeviceSession(event, currentUser, identity);
  if (!deviceSession.ok) {
    return deviceSession.response;
  }

  if (!identity.url || !identity.token) {
    return json(500, { error: 'Netlify Identity 管理令牌不可用，请确认已在 Netlify 部署并启用 Identity。' });
  }

  try {
    if (event.httpMethod === 'GET') {
      const data = await identityRequest(identity, '/admin/users', { method: 'GET' });
      return json(200, { users: normalizeUsers(data) });
    }

    const body = event.body ? JSON.parse(event.body) : {};

    if (event.httpMethod === 'POST') {
      const email = String(body.email || '').trim();
      const role = sanitizeRole(body.role);
      if (!email) return json(400, { error: '缺少邮箱。' });

      const data = await identityRequest(identity, '/invite', {
        method: 'POST',
        body: JSON.stringify({
          email,
          app_metadata: { roles: [role] },
        }),
      });

      if (data?.id) {
        await identityRequest(identity, `/admin/users/${encodeURIComponent(data.id)}`, {
          method: 'PUT',
          body: JSON.stringify({
            app_metadata: { roles: [role] },
          }),
        });
      }

      return json(200, { user: data });
    }

    if (event.httpMethod === 'PATCH') {
      const id = String(body.id || '').trim();
      const role = sanitizeRole(body.role);
      if (!id) return json(400, { error: '缺少用户 id。' });

      const data = await identityRequest(identity, `/admin/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          app_metadata: { roles: [role] },
        }),
      });
      return json(200, { user: data });
    }

    if (event.httpMethod === 'DELETE') {
      const id = String(body.id || '').trim();
      if (!id) return json(400, { error: '缺少用户 id。' });

      await identityRequest(identity, `/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return json(200, { ok: true });
    }

    return json(405, { error: '不支持的请求方法。' });
  } catch (error) {
    return json(error.status || 500, { error: error.message || '用户管理请求失败。' });
  }
};

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

function normalizeUsers(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.users)) return data.users;
  return [];
}

function getRoles(user) {
  const roles =
    user?.app_metadata?.roles ||
    user?.app_metadata?.authorization?.roles ||
    user?.user_metadata?.roles ||
    [];
  return Array.isArray(roles) ? roles : [];
}

function sanitizeRole(role) {
  return role === 'admin' ? 'admin' : 'learner';
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  };
}
