const jwt = require('jsonwebtoken');

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'od_session_token';
const AUTH_HINT_COOKIE_NAME = process.env.AUTH_HINT_COOKIE_NAME || 'od_session_hint';
const AUTH_MAX_AGE_MS = Number(process.env.AUTH_COOKIE_MAX_AGE_MS || 30 * 24 * 60 * 60 * 1000);

function parseCookieHeader(header = '') {
  return String(header || '')
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const idx = part.indexOf('=');
      if (idx === -1) return cookies;
      const key = part.slice(0, idx).trim();
      const rawValue = part.slice(idx + 1).trim();
      if (!key) return cookies;
      try { cookies[key] = decodeURIComponent(rawValue); }
      catch (_) { cookies[key] = rawValue; }
      return cookies;
    }, {});
}

function isSecureRequest(req) {
  return req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https' || process.env.NODE_ENV === 'production';
}

function authCookieOptions(req, extra = {}) {
  return {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_MAX_AGE_MS,
    ...extra
  };
}

function authHintCookieOptions(req, extra = {}) {
  return {
    httpOnly: false,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_MAX_AGE_MS,
    ...extra
  };
}

function tokenFromRequest(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  const cookies = parseCookieHeader(req.headers.cookie || '');
  return cookies[AUTH_COOKIE_NAME] || null;
}

function attachAuthCookie(req, res, token) {
  if (!token || !res?.cookie) return;
  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions(req));
  res.cookie(AUTH_HINT_COOKIE_NAME, '1', authHintCookieOptions(req));
}

function clearAuthCookie(req, res) {
  if (!res?.clearCookie) return;
  const secure = isSecureRequest(req);
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/', sameSite: 'lax', secure, httpOnly: true });
  res.clearCookie(AUTH_HINT_COOKIE_NAME, { path: '/', sameSite: 'lax', secure, httpOnly: false });
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, nick: user.nick, realName: user.real_name || user.realName },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authRequired(req, res, next) {
  const token = tokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'login_required' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    req.authToken = token;
    return next();
  } catch (error) {
    clearAuthCookie(req, res);
    return res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = {
  signToken,
  authRequired,
  parseCookieHeader,
  tokenFromRequest,
  attachAuthCookie,
  clearAuthCookie,
  AUTH_COOKIE_NAME
};
