const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const DEVICE_META_KEY = 'pdfLibraryDeviceSession';

exports.assertDeviceSession = async function assertDeviceSession(event, user, identity) {
  const sessionId = String(event.headers['x-device-session'] || event.headers['X-Device-Session'] || '').trim();

  if (!sessionId) {
    return {
      ok: false,
      response: json(401, { error: '缺少设备会话，请重新登录。' }),
    };
  }

  const userId = user && (user.sub || user.id);
  if (!identity || !identity.url || !identity.token || !userId) {
    return { ok: true, limited: false };
  }

  try {
    const freshUser = await identityRequest(identity, `/admin/users/${encodeURIComponent(userId)}`, {
      method: 'GET',
    });
    const current = freshUser?.app_metadata?.[DEVICE_META_KEY];
    const now = Date.now();

    if (!current || now - Number(current.updatedAt || 0) > SESSION_TTL_MS) {
      return { ok: true, limited: true };
    }

    if (current.sessionId !== sessionId) {
      return {
        ok: false,
        response: json(409, { error: '该账号已在另一台设备登录。' }),
      };
    }

    return { ok: true, limited: true };
  } catch (error) {
    console.error('device session assertion failed', error);
    return { ok: true, limited: false };
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
