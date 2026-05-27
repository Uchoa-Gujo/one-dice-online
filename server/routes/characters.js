const express = require('express');
const { query } = require('../database');
const { authRequired } = require('../middleware');

const router = express.Router();

router.get('/public/:id', async (req, res) => {
  const id = req.params.id;
  const result = await query('select id, owner_id, name, data, updated_at from characters where id = $1', [id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Ficha não encontrada.' });
  const row = result.rows[0];
  const data = row.data || {};
  res.json({ character: { id: row.id, ownerId: row.owner_id, name: row.name, updatedAt: row.updated_at, ...data } });
});



function firstText(value) {
  if (typeof value === 'string') return value.trim();
  return '';
}

function looksLikeImageSource(value) {
  const text = firstText(value);
  if (!text) return false;
  return /^(data:image\/|https?:\/\/|\/|\.\/|assets\/|uploads\/)/i.test(text) || /^[A-Za-z0-9+/=]{200,}$/.test(text);
}

function getDeepImageSource(data, preferredKeys = []) {
  if (!data || typeof data !== 'object') return '';

  for (const key of preferredKeys) {
    const value = data[key];
    if (looksLikeImageSource(value)) return firstText(value);
  }

  const seen = new Set();
  const queue = [data];
  const keyPattern = /(portrait|avatar|image|photo|foto|picture|icon|icone|retrato)/i;

  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item);

    for (const [key, value] of Object.entries(item)) {
      if (keyPattern.test(key) && looksLikeImageSource(value)) return firstText(value);
      if (value && typeof value === 'object') queue.push(value);
    }
  }

  return '';
}

function getObsIconMap(data) {
  const icons = data?.obsIcons || data?.obs_icons || {};
  return {
    normal: icons.normal || data?.obsIconNormal || data?.iconNormal || data?.iconeNormal || '',
    low: icons.low || data?.obsIconLow || data?.iconLow || data?.iconeFerido || data?.iconeBaixo || '',
    zero: icons.zero || data?.obsIconZero || data?.iconZero || data?.iconeZero || data?.iconeCaido || '',
    transformation: icons.transformation || data?.obsIconTransformation || data?.iconTransformation || data?.iconeTransformacao || ''
  };
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getPortraitMode(data, forcedMode = '') {
  const mode = String(forcedMode || '').trim().toLowerCase();
  if (['normal', 'low', 'zero', 'transformation'].includes(mode)) return mode;

  if (data?.isTransformation || data?.obsTransformationActive || data?.activeTransformation) return 'transformation';

  const pv = toNumber(data?.pvCurrent ?? data?.pvAtual ?? data?.pv_current ?? data?.pv ?? data?.hpCurrent ?? data?.hpAtual ?? data?.hp, 0);
  const max = Math.max(1, toNumber(data?.pvMax ?? data?.pvTotal ?? data?.pv_max ?? data?.hpMax ?? data?.hpTotal ?? data?.hp_max, 1));

  if (pv <= 0) return 'zero';
  if ((pv / max) < 0.5) return 'low';
  return 'normal';
}

function getPortraitSource(data, forcedMode = '') {
  if (!data || typeof data !== 'object') return '';

  const icons = getObsIconMap(data);
  const mode = getPortraitMode(data, forcedMode);
  const selectedIcon = icons[mode] || '';
  if (looksLikeImageSource(selectedIcon)) return firstText(selectedIcon);

  return getDeepImageSource(data, [
    'portrait', 'avatar', 'image', 'imageUrl', 'photo', 'foto', 'picture', 'portraitUrl', 'retrato'
  ]);
}

function sendImageSource(res, src) {
  if (!src) return res.redirect(302, '/assets/logo.jpg');

  const dataMatch = src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataMatch) {
    try {
      const mime = dataMatch[1];
      const buffer = Buffer.from(dataMatch[2], 'base64');
      res.type(mime);
      return res.send(buffer);
    } catch (error) {
      return res.redirect(302, '/assets/logo.jpg');
    }
  }

  // Aceita base64 puro quando a imagem foi salva sem o prefixo data:image.
  if (/^[A-Za-z0-9+/=]{200,}$/.test(src)) {
    try {
      const buffer = Buffer.from(src, 'base64');
      res.type('image/png');
      return res.send(buffer);
    } catch (error) {
      return res.redirect(302, '/assets/logo.jpg');
    }
  }

  if (/^https?:\/\//i.test(src)) return res.redirect(302, src);

  const safeLocal = `/${src.replace(/^\.\//, '').replace(/^\/+/, '')}`;
  return res.redirect(302, safeLocal || '/assets/logo.jpg');
}

router.get('/public/:id/portrait', async (req, res) => {
  const id = req.params.id;
  const result = await query('select data from characters where id = $1', [id]);
  const data = result.rows[0]?.data || {};
  const src = getPortraitSource(data, req.query.mode);

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return sendImageSource(res, src);
});

router.use(authRequired);

router.get('/', async (req, res) => {
  const result = await query(
    'select id, owner_id, name, data, created_at, updated_at from characters where owner_id = $1 order by updated_at desc',
    [req.user.id]
  );
  res.json({ characters: result.rows });
});

router.post('/', async (req, res) => {
  const limit = await query('select count(*)::int as total from characters where owner_id = $1', [req.user.id]);
  if ((limit.rows[0]?.total || 0) >= 10) return res.status(403).json({ error: 'Limite de 10 personagens por conta atingido.' });
  const name = String(req.body.name || 'Nova Ficha').trim();
  const data = req.body.data || {};
  const result = await query(
    'insert into characters (owner_id, name, data) values ($1, $2, $3) returning *',
    [req.user.id, name, data]
  );
  res.json({ character: result.rows[0] });
});

router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const name = String(req.body.name || 'Ficha').trim();
  const data = req.body.data || {};
  const result = await query(
    'update characters set name = $1, data = $2, updated_at = now() where id = $3 and owner_id = $4 returning *',
    [name, data, id, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Ficha não encontrada.' });
  const character = result.rows[0];
  const io = req.app.get('io');
  if (io) {
    const links = await query('select table_id from table_members where character_id = $1', [id]);
    links.rows.forEach(row => io.to(`table:${row.table_id}`).emit('character:updated', { tableId: row.table_id, character }));
  }
  res.json({ character });
});

router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  const owned = await query('select id from characters where id = $1 and owner_id = $2', [id, req.user.id]);
  if (!owned.rowCount) return res.status(404).json({ error: 'Ficha não encontrada.' });

  const links = await query('select table_id, user_id from table_members where character_id = $1', [id]);
  await query('update table_members set character_id = null, updated_at = now() where character_id = $1', [id]);
  await query('delete from characters where id = $1 and owner_id = $2', [id, req.user.id]);

  const io = req.app.get('io');
  if (io) {
    links.rows.forEach(row => {
      io.to(`table:${row.table_id}`).emit('character:deleted', { tableId: row.table_id, characterId: id, userId: row.user_id });
      io.to(`table:${row.table_id}`).emit('member:updated', { tableId: row.table_id, reason: 'character-deleted', userId: row.user_id, characterId: null });
    });
  }
  res.json({ ok: true, id, tables: links.rows.map(row => row.table_id) });
});

module.exports = router;
