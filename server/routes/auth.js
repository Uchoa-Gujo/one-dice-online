const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../database');
const { signToken, authRequired } = require('../middleware');

const router = express.Router();

function normalizeNick(nick) {
  return String(nick || '').trim().toLowerCase();
}

function normalizeAvatar(value) {
  return String(value || '').trim().slice(0, 250000);
}

router.post('/register', async (req, res) => {
  const nick = normalizeNick(req.body.nick);
  const realName = String(req.body.realName || '').trim();
  const password = String(req.body.password || '').trim();

  if (!/^[a-z0-9_\.\-]{3,24}$/.test(nick)) {
    return res.status(400).json({ error: 'Nick inválido. Use 3 a 24 caracteres.' });
  }
  if (realName.length < 2) {
    return res.status(400).json({ error: 'Informe o nome real.' });
  }
  if (!/^\d{6}$/.test(password)) {
    return res.status(400).json({ error: 'A senha precisa ter exatamente 6 dígitos.' });
  }

  const exists = await query('select id from users where nick = $1', [nick]);
  if (exists.rowCount) return res.status(409).json({ error: 'Esse nick já está em uso.' });

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await query(
    'insert into users (nick, real_name, password_hash) values ($1, $2, $3) returning id, nick, real_name, avatar_url, created_at',
    [nick, realName, passwordHash]
  );
  const user = created.rows[0];
  const token = signToken(user);
  res.json({ user, token });
});

router.post('/login', async (req, res) => {
  const nick = normalizeNick(req.body.nick);
  const password = String(req.body.password || '').trim();

  const found = await query('select id, nick, real_name, avatar_url, password_hash from users where nick = $1', [nick]);
  if (!found.rowCount) return res.status(401).json({ error: 'Nick ou senha inválidos.' });

  const user = found.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Nick ou senha inválidos.' });

  delete user.password_hash;
  const token = signToken(user);
  res.json({ user, token });
});

router.get('/me', authRequired, async (req, res) => {
  const found = await query('select id, nick, real_name, avatar_url, created_at from users where id = $1', [req.user.id]);
  if (!found.rowCount) return res.status(404).json({ error: 'Usuário não encontrado.' });
  res.json({ user: found.rows[0] });
});

router.put('/me', authRequired, async (req, res) => {
  const nick = normalizeNick(req.body.nick);
  const realName = String(req.body.realName || '').trim();
  const password = req.body.password == null ? '' : String(req.body.password || '').trim();
  const avatarUrl = normalizeAvatar(req.body.avatarUrl);

  if (!/^[a-z0-9_\.\-]{3,24}$/.test(nick)) return res.status(400).json({ error: 'Nick inválido. Use 3 a 24 caracteres.' });
  if (realName.length < 2) return res.status(400).json({ error: 'Informe o nome da conta.' });
  if (password && !/^\d{6}$/.test(password)) return res.status(400).json({ error: 'A senha precisa ter exatamente 6 dígitos.' });

  const exists = await query('select id from users where nick = $1 and id <> $2', [nick, req.user.id]);
  if (exists.rowCount) return res.status(409).json({ error: 'Esse nick já está em uso.' });

  let result;
  if (password) {
    const passwordHash = await bcrypt.hash(password, 10);
    result = await query(
      'update users set nick = $1, real_name = $2, password_hash = $3, avatar_url = $4, updated_at = now() where id = $5 returning id, nick, real_name, avatar_url, created_at, updated_at',
      [nick, realName, passwordHash, avatarUrl || null, req.user.id]
    );
  } else {
    result = await query(
      'update users set nick = $1, real_name = $2, avatar_url = $3, updated_at = now() where id = $4 returning id, nick, real_name, avatar_url, created_at, updated_at',
      [nick, realName, avatarUrl || null, req.user.id]
    );
  }

  if (!result.rowCount) return res.status(404).json({ error: 'Usuário não encontrado.' });
  res.json({ user: result.rows[0] });
});

module.exports = router;
