const express = require('express');
const { query } = require('../database');
const { authRequired } = require('../middleware');

const router = express.Router();

function normalizeSystemModel(value) {
  const v = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (['pool', 'pooldice', 'dados', 'ordem', 'ordemparanormal'].includes(v)) return 'pool';
  return 'd20';
}

function normalizeCharacterData(data) {
  const out = data && typeof data === 'object' ? { ...data } : {};
  const model = normalizeSystemModel(out.systemModel || out.systemType || out.sheetModel || out.diceSystem || out.ruleset);
  out.systemModel = model;
  out.systemType = model;
  out.sheetModel = model;
  return out;
}


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

function isFallbackLogo(value) {
  const text = firstText(value).toLowerCase();
  return !text || text.includes('/assets/logo') || text.includes('assets/logo') || text.includes('/assets/account-logo') || text.includes('assets/account-logo');
}

function looksLikeImageSource(value) {
  const text = firstText(value);
  if (!text) return false;
  return /^(data:image\/|https?:\/\/|\/|\.\/|assets\/|uploads\/|blob:)/i.test(text) || /^[A-Za-z0-9+/=]{200,}$/.test(text);
}

function pushImageCandidate(list, value, score, key = '') {
  const text = firstText(value);
  if (!looksLikeImageSource(text)) return;

  let finalScore = score;
  const lowerKey = String(key || '').toLowerCase();
  const lowerText = text.toLowerCase();

  if (/(portrait|retrato)/.test(lowerKey)) finalScore += 220;
  if (/(avatar|photo|foto|picture)/.test(lowerKey)) finalScore += 160;
  if (/(image|img)/.test(lowerKey)) finalScore += 80;
  if (/(icon|icone)/.test(lowerKey)) finalScore += 25;

  if (/^data:image\//i.test(text)) finalScore += 260;
  if (/^uploads\//i.test(text) || /^\/uploads\//i.test(text)) finalScore += 190;
  if (/^https?:\/\//i.test(text)) finalScore += 120;
  if (/^[A-Za-z0-9+/=]{200,}$/.test(text)) finalScore += 210;

  if (isFallbackLogo(text)) finalScore -= 1500;
  if (lowerText.includes('favicon')) finalScore -= 900;

  list.push({ src: text, score: finalScore, key });
}

function collectImageCandidates(value, list, score = 0, key = '', seen = new Set()) {
  if (!value) return;

  if (typeof value === 'string') {
    pushImageCandidate(list, value, score, key);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectImageCandidates(item, list, score - 10, `${key}[${index}]`, seen));
    return;
  }

  if (typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);

  for (const [childKey, childValue] of Object.entries(value)) {
    const nextKey = key ? `${key}.${childKey}` : childKey;
    const important = /(portrait|avatar|image|img|photo|foto|picture|icon|icone|retrato)/i.test(childKey);
    collectImageCandidates(childValue, list, score + (important ? 70 : -18), nextKey, seen);
  }
}

function getBestImageSource(data, preferredKeys = []) {
  if (!data || typeof data !== 'object') return '';

  const candidates = [];

  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      pushImageCandidate(candidates, data[key], 1200, key);
    }
  }

  collectImageCandidates(data, candidates, 0);

  const unique = [];
  const seen = new Set();
  for (const item of candidates) {
    if (!item.src || seen.has(item.src)) continue;
    seen.add(item.src);
    unique.push(item);
  }

  unique.sort((a, b) => b.score - a.score);
  return unique[0]?.src || '';
}


function getActiveTransformation(data) {
  const forms = Array.isArray(data?.transformations) ? data.transformations : [];
  if (!forms.length) return null;
  const activeId = data?.activeTransformationId || '';
  return forms.find(form => String(form.id) === String(activeId)) || forms.find(form => form?.active) || null;
}

function getActiveTransformationPortrait(data) {
  const active = getActiveTransformation(data);
  return firstText(active?.portrait || active?.image || active?.photo || active?.avatar || active?.retrato || '');
}

function getObsIconMap(data) {
  const icons = data?.obsIcons || data?.obs_icons || {};
  return {
    normal: icons.normal || data?.obsIconNormal || data?.iconNormal || data?.iconeNormal || '',
    low: icons.low || data?.obsIconLow || data?.iconLow || data?.iconeMachucado || data?.damagedPortrait || data?.iconeFerido || data?.iconeBaixo || '',
    zero: icons.zero || data?.obsIconZero || data?.iconZero || data?.iconeMorrendo || data?.dyingPortrait || data?.iconeZero || data?.iconeCaido || '',
    transformation: getActiveTransformationPortrait(data) || icons.transformation || data?.obsIconTransformation || data?.iconTransformation || data?.iconeTransformacao || ''
  };
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function getPortraitMode(data, forcedMode = '') {
  const mode = String(forcedMode || '').trim().toLowerCase();
  if (['normal', 'low', 'zero', 'transformation'].includes(mode)) return mode;

  if (data?.obsTransformationActive || data?.activeTransformation || data?.activeTransformationId) return 'transformation';

  const pv = toNumber(data?.pvCurrent ?? data?.pvAtual ?? data?.pv_current ?? data?.pv ?? data?.hpCurrent ?? data?.hpAtual ?? data?.hp, 0);
  const max = Math.max(1, toNumber(data?.pvMax ?? data?.pvTotal ?? data?.pv_max ?? data?.hpMax ?? data?.hpTotal ?? data?.hp_max, 1));

  if (pv < 0) return 'hidden';
  if (pv === 0) return 'zero';
  if ((pv / max) < 0.5) return 'low';
  return 'normal';
}

function getPortraitSource(data, forcedMode = '') {
  if (!data || typeof data !== 'object') return '';

  const basePortrait = getBestImageSource(data, [
    'portrait', 'portraitUrl', 'retrato', 'avatar', 'avatarUrl', 'image', 'imageUrl',
    'photo', 'photoUrl', 'foto', 'picture', 'pictureUrl', 'characterPortrait', 'characterImage'
  ]);

  const icons = getObsIconMap(data);
  const mode = getPortraitMode(data, forcedMode);
  if (mode === 'transformation') {
    const transformDirect = firstText(getActiveTransformationPortrait(data) || data?.obsTransformPortrait || data?.transformationPortrait || data?.activeTransformationPortrait || '');
    if (looksLikeImageSource(transformDirect) && !isFallbackLogo(transformDirect)) return transformDirect;
  }
  if (mode === 'hidden') return '';
  const selectedIcon = icons[mode] || '';

  // Ícone customizado só vence quando existe de verdade. Se cair em logo/fallback,
  // usa a foto principal da ficha para evitar o OBS travado no logo antigo.
  if (looksLikeImageSource(selectedIcon) && !isFallbackLogo(selectedIcon)) return firstText(selectedIcon);

  return basePortrait;
}

function sendImageSource(res, src) {
  if (!src) return res.redirect(302, '/assets/logo.jpg');

  const dataMatch = src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataMatch) {
    try {
      const mime = dataMatch[1];
      const buffer = Buffer.from(dataMatch[2], 'base64');
      res.type(mime);
      res.set('Content-Length', String(buffer.length));
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
      res.set('Content-Length', String(buffer.length));
      return res.send(buffer);
    } catch (error) {
      return res.redirect(302, '/assets/logo.jpg');
    }
  }

  if (/^https?:\/\//i.test(src)) return res.redirect(302, src);
  if (/^blob:/i.test(src)) return res.redirect(302, '/assets/logo.jpg');

  const safeLocal = `/${src.replace(/^\.\//, '').replace(/^\/+/, '')}`;
  return res.redirect(302, safeLocal || '/assets/logo.jpg');
}

router.get('/public/:id/portrait', async (req, res) => {
  const id = req.params.id;
  const result = await query('select data from characters where id = $1', [id]);
  const data = result.rows[0]?.data || {};
  let src = '';

  const mode = getPortraitMode(data, req.query.mode);
  if (mode === 'transformation' && data?.activeTransformationId) {
    const activePortrait = getActiveTransformationPortrait(data);
    if (looksLikeImageSource(activePortrait) && !isFallbackLogo(activePortrait)) src = activePortrait;
  }

  if (!src) src = getPortraitSource(data, req.query.mode);

  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return sendImageSource(res, src);
});

router.use(authRequired);

router.get('/', async (req, res) => {
  const result = await query(
    'select id, owner_id, name, data, created_at, updated_at from characters where owner_id = $1 order by lower(name) asc, updated_at desc',
    [req.user.id]
  );
  res.json({ characters: result.rows });
});

router.post('/', async (req, res) => {
  const limit = await query('select count(*)::int as total from characters where owner_id = $1', [req.user.id]);
  if ((limit.rows[0]?.total || 0) >= 10) return res.status(403).json({ error: 'Limite de 10 personagens por conta atingido.' });
  const name = String(req.body.name || 'Nova Ficha').trim();
  const data = normalizeCharacterData(req.body.data || {});
  const result = await query(
    'insert into characters (owner_id, name, data) values ($1, $2, $3) returning *',
    [req.user.id, name, data]
  );
  res.json({ character: result.rows[0] });
});

router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const name = String(req.body.name || 'Ficha').trim();
  const data = normalizeCharacterData(req.body.data || {});
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


module.exports = require('../async-router')(router);
