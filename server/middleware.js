const jwt = require('jsonwebtoken');

function signToken(user) {
  return jwt.sign(
    { id: user.id, nick: user.nick, realName: user.real_name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'login_required' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = { signToken, authRequired };
