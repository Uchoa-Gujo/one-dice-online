const express = require('express');
const { query } = require('../database');
const { authRequired } = require('../middleware');

const router = express.Router();
router.use(authRequired);

function makeInviteCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < 5; i += 1) out += letters[Math.floor(Math.random() * letters.length)];
  return out;
}

async function uniqueInviteCode() {
  for (let i = 0; i < 30; i += 1) {
    const code = makeInviteCode();
    const exists = await query('select id from tables where invite_code = $1', [code]);
    if (!exists.rowCount) return code;
  }
  throw new Error('Não foi possível gerar código de convite.');
}



async function memberFor(tableId, userId) {
  const result = await query('select * from table_members where table_id = $1 and user_id = $2', [tableId, userId]);
  return result.rows[0] || null;
}

function isMasterRole(role) {
  return role === 'master' || role === 'master_player' || role === 'mestre' || role === 'mestre_jogador';
}

function trimEventPayload(payload) {
  try {
    const text = JSON.stringify(payload || {});
    if (text.length <= 750000) return payload || {};
    return { truncated: true, reason: 'payload-too-large', keys: Object.keys(payload || {}) };
  } catch (_) {
    return { truncated: true, reason: 'payload-not-json' };
  }
}

function emitTable(req, tableId, eventName, payload = {}) {
  const io = req.app.get('io');
  const key = String(tableId);
  const cleanPayload = { tableId: key, ...trimEventPayload(payload) };

  // V194.3: todo evento da mesa também fica registrado no banco.
  // Assim, se o socket falhar, o cliente recupera pelo endpoint /events.
  if (Math.random() < 0.02) {
    query("delete from table_events where created_at < now() - interval '72 hours'").catch(() => {});
  }
  query(
    'insert into table_events (table_id, event_name, payload) values ($1, $2, $3) returning id, created_at',
    [key, String(eventName), cleanPayload]
  ).then(result => {
    const eventId = result.rows[0]?.id || null;
    const createdAt = result.rows[0]?.created_at || new Date().toISOString();
    const eventPayload = { ...cleanPayload, eventId, createdAt };
    if (io) {
      io.to(`table:${key}`).emit(eventName, eventPayload);
      io.to(`table:${key}`).emit('table:event', { tableId: key, eventName, eventId, createdAt, payload: cleanPayload });
    }
  }).catch(error => {
    console.warn('Falha ao persistir evento de mesa:', eventName, error.message || error);
    if (io) io.to(`table:${key}`).emit(eventName, cleanPayload);
  });
}

// V194.1 - presença HTTP como fallback do Socket.IO.
// Mantém online/offline funcionando mesmo se o socket perder evento no navegador.
function od1941PresenceStore(req) {
  let store = req.app.get('od1941PresenceStore');
  if (!store) {
    store = new Map();
    req.app.set('od1941PresenceStore', store);
  }
  return store;
}
function od1941PresenceList(req, tableId) {
  const store = od1941PresenceStore(req);
  const key = String(tableId);
  const now = Date.now();
  const table = store.get(key) || new Map();
  for (const [userId, at] of table.entries()) {
    if (now - Number(at || 0) > 25000) table.delete(userId);
  }
  if (!table.size) store.delete(key);
  else store.set(key, table);
  return Array.from(table.keys());
}
function od1941TouchPresence(req, tableId) {
  const store = od1941PresenceStore(req);
  const key = String(tableId);
  const table = store.get(key) || new Map();
  table.set(String(req.user.id), Date.now());
  store.set(key, table);
  const onlineUserIds = od1941PresenceList(req, key);
  const io = req.app.get('io');
  if (io) io.to(`table:${key}`).emit('presence:updated', { tableId: key, onlineUserIds, at: new Date().toISOString(), source: 'http' });
  return onlineUserIds;
}


async function od1943TouchPresence(req, tableId) {
  const key = String(tableId);
  try {
    await query(`
      insert into table_presence (table_id, user_id, last_seen, client_id)
      values ($1, $2, now(), $3)
      on conflict (table_id, user_id)
      do update set last_seen = excluded.last_seen, client_id = excluded.client_id
    `, [key, req.user.id, String(req.body?.clientId || req.query?.clientId || '').slice(0, 80)]);
    await query("delete from table_presence where last_seen < now() - interval '35 seconds'");
    const result = await query(`
      select user_id
      from table_presence
      where table_id = $1 and last_seen > now() - interval '25 seconds'
      order by last_seen desc
    `, [key]);
    const onlineUserIds = result.rows.map(row => row.user_id);
    const io = req.app.get('io');
    if (io) io.to(`table:${key}`).emit('presence:updated', { tableId: key, onlineUserIds, at: new Date().toISOString(), source: 'db' });
    return onlineUserIds;
  } catch (error) {
    console.warn('Presença DB indisponível, usando memória:', error.message || error);
    return od1941TouchPresence(req, key);
  }
}

async function od1943LastEventId(tableId) {
  try {
    const result = await query('select coalesce(max(id), 0)::bigint as id from table_events where table_id = $1', [String(tableId)]);
    return Number(result.rows[0]?.id || 0);
  } catch (_) {
    return 0;
  }
}

async function requireTableMember(req, res, next) {
  const tableId = req.params.id;
  const member = await memberFor(tableId, req.user.id);
  if (!member) return res.status(403).json({ error: 'Você não participa desta campanha.' });
  req.tableMember = member;
  next();
}

async function requireTableMaster(req, res, next) {
  const tableId = req.params.id;
  const member = await memberFor(tableId, req.user.id);
  if (!member || !isMasterRole(member.role)) return res.status(403).json({ error: 'Apenas o mestre pode realizar esta ação.' });
  req.tableMember = member;
  next();
}



function normalizeDrops(settings) {
  const drops = settings && Array.isArray(settings.drops) ? settings.drops : [];
  return drops.slice(0, 200);
}

function itemWeightTotal(items) {
  return (Array.isArray(items) ? items : []).reduce((sum, entry) => sum + (Number(entry.weight) || 0), 0);
}

async function updateTableDrops(tableId, drops) {
  const result = await query(`
    update tables
    set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{drops}', $1::jsonb, true), revision = coalesce(revision, 0) + 1, updated_at = now()
    where id = $2
    returning settings
  `, [JSON.stringify(drops), tableId]);
  return normalizeDrops(result.rows[0]?.settings || {});
}



function normalizeSystemModel(value) {
  const v = String(value || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (['pool', 'pooldice', 'dados', 'ordem', 'ordemparanormal'].includes(v)) return 'pool';
  return 'd20';
}


function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}
function hasUsefulObject(value) { return isPlainObject(value) && Object.keys(value).length > 0; }
function hasUsefulArray(value) { return Array.isArray(value) && value.length > 0; }
function mergeObjectsPreservingExisting(existing = {}, incoming = {}) {
  const out = { ...(isPlainObject(existing) ? existing : {}), ...(isPlainObject(incoming) ? incoming : {}) };
  if (isPlainObject(existing) && isPlainObject(incoming)) {
    for (const [key, value] of Object.entries(existing)) {
      if (isPlainObject(value) && isPlainObject(incoming[key])) out[key] = mergeObjectsPreservingExisting(value, incoming[key]);
      else if ((incoming[key] === undefined || incoming[key] === null || incoming[key] === '') && value !== undefined && value !== null && value !== '') out[key] = value;
    }
  }
  return out;
}
function mergeCharacterDataSafely(existingData = {}, incomingData = {}) {
  const existing = isPlainObject(existingData) ? existingData : {};
  const incoming = isPlainObject(incomingData) ? incomingData : {};
  const out = { ...existing, ...incoming };
  ['inventoryItems','blockInventory','abilities','spells','attacks','conditions','transformations','dropItems'].forEach(key => {
    if (hasUsefulArray(existing[key]) && !hasUsefulArray(incoming[key])) out[key] = existing[key];
  });
  ['skills','resistances','attrs','caster','obsIcons','portraitCrop','settings'].forEach(key => {
    if (hasUsefulObject(existing[key]) || hasUsefulObject(incoming[key])) out[key] = mergeObjectsPreservingExisting(existing[key] || {}, incoming[key] || {});
  });
  ['abilitiesNotes','equipmentNotes'].forEach(key => {
    if (typeof existing[key] === 'string' && existing[key].trim() && !(typeof incoming[key] === 'string' && incoming[key].trim())) out[key] = existing[key];
  });
  return out;
}

function tableSystemModel(table) {
  return normalizeSystemModel(table?.settings?.systemModel || table?.settings?.systemType || table?.system_model || table?.system_type);
}

function characterSystemModel(data) {
  return normalizeSystemModel(data?.systemModel || data?.systemType || data?.sheetModel || data?.diceSystem || data?.ruleset);
}

async function assertCompatibleCharacter(tableId, characterId, userId) {
  if (!characterId) return;
  const tableResult = await query('select settings from tables where id = $1', [tableId]);
  if (!tableResult.rowCount) {
    const err = new Error('Campanha não encontrada.');
    err.status = 404;
    throw err;
  }
  const characterResult = await query('select id, data from characters where id = $1 and owner_id = $2', [characterId, userId]);
  if (!characterResult.rowCount) {
    const err = new Error('Essa ficha não pertence a você.');
    err.status = 403;
    throw err;
  }
  const tableModel = tableSystemModel(tableResult.rows[0]);
  const charModel = characterSystemModel(characterResult.rows[0].data || {});
  if (tableModel !== charModel) {
    const err = new Error(`Essa campanha usa ${tableModel === 'pool' ? 'Pool Dice' : 'D20'}. Escolha uma ficha do mesmo modelo.`);
    err.status = 400;
    throw err;
  }
}

function apiRole(role) {
  if (role === 'mestre') return 'master';
  if (role === 'jogador') return 'player';
  if (role === 'mestre_jogador') return 'master_player';
  return role;
}

// V194.2 - helpers de revisão para sincronização mais fluida.
async function touchTableRevision(tableId) {
  try {
    await query('update tables set revision = coalesce(revision, 0) + 1, updated_at = now() where id = $1', [tableId]);
  } catch (error) {
    // Compatibilidade com bancos antigos sem coluna revision: updated_at já ajuda o cliente.
    await query('update tables set updated_at = now() where id = $1', [tableId]);
  }
}
function responseHeadersNoStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

router.get('/', async (req, res) => {
  responseHeadersNoStore(res);
  const result = await query(`
    select t.id, t.owner_id, t.name, t.invite_code, t.description, t.logo_url,
      coalesce(t.settings, '{}'::jsonb) as settings, t.created_at, t.updated_at,
      coalesce(t.revision, 0) as revision,
      tm.role, tm.character_id,
      count(all_tm.id)::int as player_count
    from table_members tm
    join tables t on t.id = tm.table_id
    left join table_members all_tm on all_tm.table_id = t.id
    where tm.user_id = $1
    group by t.id, tm.role, tm.character_id
    order by lower(t.name) asc, t.updated_at desc
  `, [req.user.id]);
  res.json({ tables: result.rows, serverNow: new Date().toISOString() });
});

router.post('/', async (req, res) => {
  const limit = await query('select count(*)::int as total from tables where owner_id = $1', [req.user.id]);
  if ((limit.rows[0]?.total || 0) >= 10) return res.status(403).json({ error: 'Limite de 10 campanhas por conta atingido.' });
  const name = String(req.body.name || 'Nova Mesa').trim().slice(0, 80) || 'Nova Mesa';
  const description = String(req.body.description || '').trim().slice(0, 200);
  const logoUrl = String(req.body.logoUrl || req.body.logo_url || '').trim().slice(0, 200000);
  const systemModel = normalizeSystemModel(req.body.systemType || req.body.systemModel || req.body?.settings?.systemType || req.body?.settings?.systemModel);
  const settings = { ...(req.body.settings && typeof req.body.settings === 'object' ? req.body.settings : {}), systemType: systemModel, systemModel };
  const code = await uniqueInviteCode();

  const created = await query(
    'insert into tables (name, owner_id, invite_code, description, logo_url, settings) values ($1, $2, $3, $4, $5, $6) returning *',
    [name, req.user.id, code, description, logoUrl, settings]
  );
  const table = created.rows[0];

  await query(
    `insert into table_members (table_id, user_id, role)
     values ($1, $2, 'master')
     on conflict (table_id, user_id) do nothing`,
    [table.id, req.user.id]
  );

  await touchTableRevision(table.id);
  emitTable(req, table.id, 'table:updated', { reason: 'created' });
  res.json({ table });
});

router.post('/join', async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const characterId = req.body.characterId || null;

  if (!/^[A-Z]{5}$/.test(code)) {
    return res.status(400).json({ error: 'Código de convite inválido.' });
  }

  const found = await query('select * from tables where invite_code = $1', [code]);
  if (!found.rowCount) return res.status(404).json({ error: 'Campanha não encontrada.' });
  const table = found.rows[0];

  const wantedRole = table.owner_id === req.user.id ? 'master_player' : 'player';

  try {
    await assertCompatibleCharacter(table.id, characterId, req.user.id);
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message || 'Ficha incompatível com a campanha.' });
  }

  await query(`
    insert into table_members (table_id, user_id, role, character_id)
    values ($1, $2, $3, $4)
    on conflict (table_id, user_id)
    do update set character_id = coalesce(excluded.character_id, table_members.character_id),
                  role = case
                    when table_members.role = 'master' and excluded.role = 'master_player' then 'master_player'
                    when table_members.role = 'master_player' then 'master_player'
                    else table_members.role
                  end,
                  updated_at = now()
  `, [table.id, req.user.id, wantedRole, characterId]);

  await touchTableRevision(table.id);
  emitTable(req, table.id, 'member:updated', { reason: 'join' });
  res.json({ table, role: wantedRole });
});


// V194.1 - presença online por HTTP.
router.post('/:id/presence', requireTableMember, async (req, res) => {
  responseHeadersNoStore(res);
  const tableId = req.params.id;
  const onlineUserIds = await od1943TouchPresence(req, tableId);
  const lastEventId = await od1943LastEventId(tableId);
  res.json({ tableId: String(tableId), onlineUserIds, lastEventId, at: new Date().toISOString() });
});

router.get('/:id/presence', requireTableMember, async (req, res) => {
  responseHeadersNoStore(res);
  const tableId = req.params.id;
  const onlineUserIds = await od1943TouchPresence(req, tableId);
  const lastEventId = await od1943LastEventId(tableId);
  res.json({ tableId: String(tableId), onlineUserIds, lastEventId, at: new Date().toISOString() });
});

router.get('/:id/events', requireTableMember, async (req, res) => {
  responseHeadersNoStore(res);
  const tableId = req.params.id;
  const after = Math.max(0, Number(req.query.after || 0) || 0);
  const limit = Math.max(1, Math.min(250, Number(req.query.limit || 120) || 120));
  const onlineUserIds = await od1943TouchPresence(req, tableId);
  const result = await query(`
    select id, event_name, payload, created_at
    from table_events
    where table_id = $1 and id > $2
    order by id asc
    limit $3
  `, [tableId, after, limit]);
  const lastEventId = await od1943LastEventId(tableId);
  res.json({
    tableId: String(tableId),
    onlineUserIds,
    lastEventId,
    events: result.rows.map(row => ({
      id: Number(row.id || 0),
      eventId: Number(row.id || 0),
      eventName: row.event_name,
      payload: row.payload || {},
      createdAt: row.created_at
    })),
    serverNow: new Date().toISOString()
  });
});

router.get('/:id/state', async (req, res) => {
  responseHeadersNoStore(res);
  const tableId = req.params.id;
  const isMember = await query('select id from table_members where table_id = $1 and user_id = $2', [tableId, req.user.id]);
  if (!isMember.rowCount) return res.status(403).json({ error: 'Você não participa desta campanha.' });

  const tableResult = await query(`
    select id, owner_id, name, invite_code, description, logo_url,
      coalesce(settings, '{}'::jsonb) as settings,
      created_at, updated_at, coalesce(revision, 0) as revision
    from tables
    where id = $1
  `, [tableId]);
  if (!tableResult.rowCount) return res.status(404).json({ error: 'Campanha não encontrada.' });

  const members = await query(`
    select tm.id, tm.table_id, tm.user_id, tm.role, tm.character_id,
      tm.created_at, tm.updated_at, coalesce(tm.revision, 0) as revision,
      u.nick, u.real_name, u.avatar_url, u.updated_at as user_updated_at,
      c.name as character_name, c.data as character_data,
      c.updated_at as character_updated_at, coalesce(c.revision, 0) as character_revision
    from table_members tm
    join users u on u.id = tm.user_id
    left join characters c on c.id = tm.character_id
    where tm.table_id = $1
    order by lower(coalesce(c.name, u.real_name, u.nick)) asc, tm.created_at asc
  `, [tableId]);

  const onlineUserIds = await od1943TouchPresence(req, tableId);
  const lastEventId = await od1943LastEventId(tableId);
  const revision = Math.max(
    Number(tableResult.rows[0]?.revision || 0),
    ...members.rows.map(row => Number(row.revision || 0)),
    ...members.rows.map(row => Number(row.character_revision || 0))
  );

  res.json({
    table: tableResult.rows[0],
    members: members.rows,
    onlineUserIds,
    lastEventId,
    revision,
    serverNow: new Date().toISOString(),
    counts: {
      members: members.rows.length,
      characters: members.rows.filter(row => row.character_id).length
    }
  });
});


router.put('/:id', requireTableMaster, async (req, res) => {
  const tableId = req.params.id;
  const name = String(req.body.name || 'Campanha').trim().slice(0, 80) || 'Campanha';
  const description = String(req.body.description || '').trim().slice(0, 200);
  const logoUrl = String(req.body.logoUrl || req.body.logo_url || '').trim().slice(0, 200000);
  const currentTable = await query('select settings from tables where id = $1 and owner_id = $2', [tableId, req.user.id]);
  const previousSettings = currentTable.rows[0]?.settings || {};
  const systemModel = normalizeSystemModel(req.body.systemType || req.body.systemModel || req.body?.settings?.systemType || req.body?.settings?.systemModel || previousSettings.systemType || previousSettings.systemModel);
  const incomingSettings = req.body.settings && typeof req.body.settings === 'object' ? req.body.settings : {};
  const settings = {
    ...previousSettings,
    ...incomingSettings,
    systemType: systemModel,
    systemModel,
    bannerUrl: String(incomingSettings.bannerUrl || incomingSettings.banner || previousSettings.bannerUrl || previousSettings.banner || '').trim().slice(0, 200000),
    theme: String(incomingSettings.theme || previousSettings.theme || 'red').trim().slice(0, 32),
    summary: String(incomingSettings.summary || previousSettings.summary || '').trim().slice(0, 4000),
    rules: String(incomingSettings.rules || previousSettings.rules || '').trim().slice(0, 6000),
    inviteText: String(incomingSettings.inviteText || incomingSettings.invite || previousSettings.inviteText || '').trim().slice(0, 1000),
    tone: String(incomingSettings.tone || previousSettings.tone || '').trim().slice(0, 80),
    safety: String(incomingSettings.safety || previousSettings.safety || '').trim().slice(0, 1200),
    tags: Array.isArray(incomingSettings.tags)
      ? incomingSettings.tags.map(tag => String(tag || '').trim().slice(0, 24)).filter(Boolean).slice(0, 8)
      : (Array.isArray(previousSettings.tags) ? previousSettings.tags : []),
    owlbearEnabled: incomingSettings.owlbearEnabled === false ? false : Boolean(incomingSettings.owlbearUrl || incomingSettings.owlbearRoomUrl || previousSettings.owlbearUrl || previousSettings.owlbearRoomUrl || incomingSettings.owlbearEnabled || previousSettings.owlbearEnabled),
    owlbearUrl: String(incomingSettings.owlbearUrl || incomingSettings.owlbearRoomUrl || previousSettings.owlbearUrl || previousSettings.owlbearRoomUrl || '').trim().slice(0, 2000),
    owlbearRoomUrl: String(incomingSettings.owlbearRoomUrl || incomingSettings.owlbearUrl || previousSettings.owlbearRoomUrl || previousSettings.owlbearUrl || '').trim().slice(0, 2000),
    owlbearSceneUrl: String(incomingSettings.owlbearSceneUrl || previousSettings.owlbearSceneUrl || '').trim().slice(0, 2000),
    owlbearNote: String(incomingSettings.owlbearNote || previousSettings.owlbearNote || '').trim().slice(0, 1000)
  };

  const result = await query(`
    update tables
    set name = $1, description = $2, logo_url = $3, settings = $4,
        revision = coalesce(revision, 0) + 1, updated_at = now()
    where id = $5 and owner_id = $6
    returning *
  `, [name, description, logoUrl, settings, tableId, req.user.id]);

  if (!result.rowCount) return res.status(403).json({ error: 'Somente o mestre dono pode editar esta campanha.' });
  emitTable(req, tableId, 'table:updated', { reason: 'metadata-updated', table: result.rows[0] });
  res.json({ table: result.rows[0] });
});

router.put('/:id/member', async (req, res) => {
  const tableId = req.params.id;
  const characterId = req.body.characterId || null;

  try {
    await assertCompatibleCharacter(tableId, characterId, req.user.id);
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message || 'Ficha incompatível com a campanha.' });
  }

  const tableResult = await query('select * from tables where id = $1', [tableId]);
  if (!tableResult.rowCount) return res.status(404).json({ error: 'Campanha não encontrada.' });
  const table = tableResult.rows[0];

  const existing = await query('select * from table_members where table_id = $1 and user_id = $2', [tableId, req.user.id]);
  if (!existing.rowCount) return res.status(403).json({ error: 'Você não participa desta campanha.' });

  let role = existing.rows[0].role;
  if (table.owner_id === req.user.id && role === 'master' && characterId) role = 'master_player';
  if (table.owner_id === req.user.id && role === 'master_player' && !characterId) role = 'master';

  const updated = await query(`
    update table_members
    set character_id = $1, role = $2, revision = coalesce(revision, 0) + 1, updated_at = now()
    where table_id = $3 and user_id = $4
    returning *
  `, [characterId, role, tableId, req.user.id]);

  await touchTableRevision(tableId);
  emitTable(req, tableId, 'member:updated', { reason: 'character-linked', member: updated.rows[0] });
  res.json({ member: updated.rows[0] });
});


router.delete('/:id/members/:memberId/character', requireTableMaster, async (req, res) => {
  const tableId = req.params.id;
  const memberId = req.params.memberId;

  const target = await query('select * from table_members where id = $1 and table_id = $2', [memberId, tableId]);
  if (!target.rowCount) return res.status(404).json({ error: 'Jogador não encontrado nesta campanha.' });

  const member = target.rows[0];
  const nextRole = member.role === 'master_player' ? 'master' : member.role;
  const updated = await query(`
    update table_members
    set character_id = null, role = $1, revision = coalesce(revision, 0) + 1, updated_at = now()
    where id = $2 and table_id = $3
    returning *
  `, [nextRole, memberId, tableId]);

  await touchTableRevision(tableId);
  emitTable(req, tableId, 'member:updated', {
    reason: 'character-unlinked-by-master',
    member: updated.rows[0],
    userId: member.user_id,
    removedCharacterId: member.character_id || null
  });
  res.json({ ok: true, member: updated.rows[0], removedCharacterId: member.character_id || null });
});

router.delete('/:id/members/:memberId', requireTableMaster, async (req, res) => {
  const tableId = req.params.id;
  const memberId = req.params.memberId;

  const target = await query('select * from table_members where id = $1 and table_id = $2', [memberId, tableId]);
  if (!target.rowCount) return res.status(404).json({ error: 'Jogador não encontrado nesta campanha.' });

  const member = target.rows[0];
  if (String(member.user_id) === String(req.user.id)) {
    return res.status(400).json({ error: 'O mestre não pode remover a própria entrada por aqui.' });
  }

  await query('delete from table_members where id = $1 and table_id = $2', [memberId, tableId]);
  await touchTableRevision(tableId);

  const remaining = await query('select count(*)::int as total from table_members where table_id = $1', [tableId]);
  if ((remaining.rows[0]?.total || 0) <= 0) {
    await query('delete from chat_messages where table_id = $1', [tableId]);
    emitTable(req, tableId, 'messages:cleared', { reason: 'empty-table' });
  }

  emitTable(req, tableId, 'member:updated', {
    reason: 'member-removed',
    removedMemberId: memberId,
    userId: member.user_id,
    characterId: member.character_id || null
  });
  res.json({ ok: true, removedMemberId: memberId, userId: member.user_id, characterId: member.character_id || null });
});




router.get('/:id/messages', requireTableMember, async (req, res) => {
  const tableId = req.params.id;
  const result = await query(`
    select cm.*, u.nick, u.real_name, u.avatar_url, c.name as character_name, c.data as character_data
    from chat_messages cm
    left join users u on u.id = cm.user_id
    left join characters c on c.id = cm.character_id
    where cm.table_id = $1
    order by cm.created_at asc
    limit 250
  `, [tableId]);
  res.json({ messages: result.rows });
});

router.post('/:id/messages', requireTableMember, async (req, res) => {
  const tableId = req.params.id;
  const channel = ['conversation', 'rolls', 'system'].includes(req.body.channel) ? req.body.channel : 'conversation';
  const message = String(req.body.message || '').trim().slice(0, 2000);
  const characterId = req.body.characterId || null;
  if (!message) return res.status(400).json({ error: 'Mensagem vazia.' });

  const created = await query(`
    insert into chat_messages (table_id, user_id, character_id, channel, message, payload)
    values ($1, $2, $3, $4, $5, $6)
    returning *
  `, [tableId, req.user.id, characterId, channel, message, req.body.payload || {}]);

  const msg = created.rows[0];
  emitTable(req, tableId, 'message:created', { message: msg });
  res.json({ message: msg });
});



router.delete('/:id/messages', requireTableMaster, async (req, res) => {
  const tableId = req.params.id;
  await query('delete from chat_messages where table_id = $1', [tableId]);
  emitTable(req, tableId, 'messages:cleared', { reason: 'reset-chat' });
  res.json({ ok: true });
});


router.get('/:id/drops', requireTableMember, async (req, res) => {
  const tableId = req.params.id;
  const result = await query('select settings from tables where id = $1', [tableId]);
  if (!result.rowCount) return res.status(404).json({ error: 'Campanha não encontrada.' });
  res.json({ drops: normalizeDrops(result.rows[0].settings || {}) });
});

router.post('/:id/drop-item', requireTableMember, async (req, res) => {
  const tableId = req.params.id;
  const fromCharacterId = req.body.fromCharacterId || null;
  const itemId = req.body.itemId || null;
  if (!fromCharacterId || !itemId) return res.status(400).json({ error: 'Dados do drop incompletos.' });

  const links = await query(`
    select tm.character_id, tm.user_id, tm.role, c.owner_id, c.name, c.data
    from table_members tm
    join characters c on c.id = tm.character_id
    where tm.table_id = $1 and tm.character_id = $2
  `, [tableId, fromCharacterId]);
  if (!links.rowCount) return res.status(404).json({ error: 'Ficha não vinculada à campanha.' });
  const from = links.rows[0];
  const isMaster = isMasterRole(req.tableMember.role);
  if (String(from.owner_id) !== String(req.user.id) && !isMaster) {
    return res.status(403).json({ error: 'Você só pode dropar itens da sua própria ficha.' });
  }

  const fromData = from.data || {};
  const fromItems = Array.isArray(fromData.inventoryItems) ? fromData.inventoryItems : [];
  const index = fromItems.findIndex(item => String(item.id) === String(itemId));
  if (index < 0) return res.status(404).json({ error: 'Item não encontrado na ficha.' });
  const [item] = fromItems.splice(index, 1);
  fromData.inventoryItems = fromItems;
  fromData.weightCurrent = itemWeightTotal(fromItems);
  const updatedFrom = await query('update characters set data = $1, revision = coalesce(revision, 0) + 1, updated_at = now() where id = $2 returning *', [fromData, fromCharacterId]);

  const tableResult = await query('select settings from tables where id = $1', [tableId]);
  const drops = normalizeDrops(tableResult.rows[0]?.settings || {});
  const drop = { ...item, id: `drop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, fromCharacterId, fromName: from.name, createdAt: new Date().toISOString() };
  drops.push(drop);
  const savedDrops = await updateTableDrops(tableId, drops);

  emitTable(req, tableId, 'character:updated', { character: updatedFrom.rows[0] });
  emitTable(req, tableId, 'inventory:updated', { reason: 'drop-item', fromCharacterId, itemName: item.name || 'Item', drops: savedDrops });
  res.json({ ok: true, item: drop, from: updatedFrom.rows[0], drops: savedDrops });
});

router.post('/:id/drops/:dropId/take', requireTableMember, async (req, res) => {
  const tableId = req.params.id;
  const dropId = req.params.dropId;
  const toCharacterId = req.body.toCharacterId || null;
  if (!toCharacterId) return res.status(400).json({ error: 'Escolha a ficha que vai receber.' });

  const links = await query(`
    select tm.character_id, tm.user_id, tm.role, c.owner_id, c.name, c.data
    from table_members tm
    join characters c on c.id = tm.character_id
    where tm.table_id = $1 and tm.character_id = $2
  `, [tableId, toCharacterId]);
  if (!links.rowCount) return res.status(404).json({ error: 'Ficha não vinculada à campanha.' });
  const to = links.rows[0];
  const isMaster = isMasterRole(req.tableMember.role);
  if (String(to.owner_id) !== String(req.user.id) && !isMaster) {
    return res.status(403).json({ error: 'Você só pode pegar drops para sua própria ficha.' });
  }

  const tableResult = await query('select settings from tables where id = $1', [tableId]);
  const drops = normalizeDrops(tableResult.rows[0]?.settings || {});
  const index = drops.findIndex(item => String(item.id) === String(dropId));
  if (index < 0) return res.status(404).json({ error: 'Drop não encontrado.' });
  const [item] = drops.splice(index, 1);

  const toData = to.data || {};
  const toItems = Array.isArray(toData.inventoryItems) ? toData.inventoryItems : [];
  const itemForCharacter = { ...item, id: item.originalItemId || `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
  delete itemForCharacter.fromCharacterId;
  delete itemForCharacter.fromName;
  delete itemForCharacter.createdAt;
  delete itemForCharacter.originalItemId;
  toItems.push(itemForCharacter);
  toData.inventoryItems = toItems;
  toData.weightCurrent = itemWeightTotal(toItems);
  const updatedTo = await query('update characters set data = $1, revision = coalesce(revision, 0) + 1, updated_at = now() where id = $2 returning *', [toData, toCharacterId]);
  const savedDrops = await updateTableDrops(tableId, drops);

  emitTable(req, tableId, 'character:updated', { character: updatedTo.rows[0] });
  emitTable(req, tableId, 'inventory:updated', { reason: 'take-drop', toCharacterId, itemName: item.name || 'Item', drops: savedDrops });
  res.json({ ok: true, item, to: updatedTo.rows[0], drops: savedDrops });
});



router.delete('/:id/drops/:dropId', requireTableMember, async (req, res) => {
  const tableId = req.params.id;
  const dropId = req.params.dropId;

  const tableResult = await query('select settings from tables where id = $1', [tableId]);
  if (!tableResult.rowCount) return res.status(404).json({ error: 'Campanha não encontrada.' });

  const drops = normalizeDrops(tableResult.rows[0]?.settings || {});
  const index = drops.findIndex(item => String(item.id) === String(dropId));
  if (index < 0) return res.status(404).json({ error: 'Drop não encontrado.' });

  const item = drops[index];
  const isMaster = isMasterRole(req.tableMember.role);
  if (!isMaster && item.fromCharacterId) {
    const own = await query('select id from characters where id = $1 and owner_id = $2', [item.fromCharacterId, req.user.id]);
    if (!own.rowCount) return res.status(403).json({ error: 'Apenas o mestre ou quem dropou pode excluir este item.' });
  } else if (!isMaster && !item.fromCharacterId) {
    return res.status(403).json({ error: 'Apenas o mestre pode excluir este item.' });
  }

  const [removed] = drops.splice(index, 1);
  const savedDrops = await updateTableDrops(tableId, drops);
  emitTable(req, tableId, 'inventory:updated', { reason: 'delete-drop', itemName: removed.name || 'Item', drops: savedDrops });
  res.json({ ok: true, item: removed, drops: savedDrops });
});

router.post('/:id/transfer-item', requireTableMember, async (req, res) => {
  const tableId = req.params.id;
  const fromCharacterId = req.body.fromCharacterId || null;
  const toCharacterId = req.body.toCharacterId || null;
  const itemId = req.body.itemId || null;
  if (!fromCharacterId || !toCharacterId || !itemId) {
    return res.status(400).json({ error: 'Dados da transferência incompletos.' });
  }
  if (fromCharacterId === toCharacterId) {
    return res.status(400).json({ error: 'Escolha outro personagem para receber.' });
  }

  const links = await query(`
    select tm.character_id, tm.user_id, tm.role, c.owner_id, c.name, c.data
    from table_members tm
    join characters c on c.id = tm.character_id
    where tm.table_id = $1 and tm.character_id in ($2, $3)
  `, [tableId, fromCharacterId, toCharacterId]);

  const from = links.rows.find(row => String(row.character_id) === String(fromCharacterId));
  const to = links.rows.find(row => String(row.character_id) === String(toCharacterId));
  if (!from || !to) return res.status(404).json({ error: 'Uma das fichas não está vinculada à mesa.' });

  const isMaster = isMasterRole(req.tableMember.role);
  if (String(from.owner_id) !== String(req.user.id) && !isMaster) {
    return res.status(403).json({ error: 'Você só pode transferir itens da sua própria ficha.' });
  }

  const fromData = from.data || {};
  const toData = to.data || {};
  const fromItems = Array.isArray(fromData.inventoryItems) ? fromData.inventoryItems : [];
  const index = fromItems.findIndex(item => String(item.id) === String(itemId));
  if (index < 0) return res.status(404).json({ error: 'Item não encontrado na ficha de origem.' });

  const [item] = fromItems.splice(index, 1);
  const toItems = Array.isArray(toData.inventoryItems) ? toData.inventoryItems : [];
  toItems.push({ ...item, id: item.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}` });

  fromData.inventoryItems = fromItems;
  toData.inventoryItems = toItems;
  fromData.weightCurrent = fromItems.reduce((sum, entry) => sum + (Number(entry.weight) || 0), 0);
  toData.weightCurrent = toItems.reduce((sum, entry) => sum + (Number(entry.weight) || 0), 0);

  const updatedFrom = await query('update characters set data = $1, revision = coalesce(revision, 0) + 1, updated_at = now() where id = $2 returning *', [fromData, fromCharacterId]);
  const updatedTo = await query('update characters set data = $1, revision = coalesce(revision, 0) + 1, updated_at = now() where id = $2 returning *', [toData, toCharacterId]);

  emitTable(req, tableId, 'character:updated', { character: updatedFrom.rows[0] });
  emitTable(req, tableId, 'character:updated', { character: updatedTo.rows[0] });
  emitTable(req, tableId, 'inventory:updated', { reason: 'transfer-item', fromCharacterId, toCharacterId, itemName: item.name || 'Item' });

  res.json({ ok: true, item, from: updatedFrom.rows[0], to: updatedTo.rows[0] });
});

router.get('/:id/initiative', requireTableMember, async (req, res) => {
  const tableId = req.params.id;
  const result = await query('select settings from tables where id = $1', [tableId]);
  if (!result.rowCount) return res.status(404).json({ error: 'Campanha não encontrada.' });
  const initiative = result.rows[0].settings?.initiative || { active: false, round: 1, entries: [] };
  res.json({ initiative });
});

router.put('/:id/initiative', requireTableMember, async (req, res) => {
  const tableId = req.params.id;
  const initiative = req.body.initiative || { active: false, round: 1, entries: [] };
  initiative.active = !!initiative.active;
  initiative.round = Number(initiative.round || 1);
  initiative.entries = Array.isArray(initiative.entries) ? initiative.entries.slice(0, 100) : [];

  const result = await query(`
    update tables
    set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{initiative}', $1::jsonb, true),
        revision = coalesce(revision, 0) + 1, updated_at = now()
    where id = $2
    returning settings, revision
  `, [JSON.stringify(initiative), tableId]);
  const saved = result.rows[0]?.settings?.initiative || initiative;
  emitTable(req, tableId, 'initiative:updated', { initiative: saved });
  res.json({ initiative: saved });
});

router.put('/:id/characters/:characterId', requireTableMaster, async (req, res) => {
  const tableId = req.params.id;
  const characterId = req.params.characterId;
  const linked = await query('select id from table_members where table_id = $1 and character_id = $2', [tableId, characterId]);
  if (!linked.rowCount) return res.status(404).json({ error: 'Ficha não está vinculada a esta mesa.' });

  const name = String(req.body.name || req.body.data?.name || 'Ficha').trim().slice(0, 120) || 'Ficha';
  const previous = await query('select data from characters where id = $1', [characterId]);
  const data = mergeCharacterDataSafely(previous.rows[0]?.data || {}, req.body.data || {});
  const result = await query(
    'update characters set name = $1, data = $2, revision = coalesce(revision, 0) + 1, updated_at = now() where id = $3 returning *',
    [name, data, characterId]
  );
  await touchTableRevision(tableId);
  if (!result.rowCount) return res.status(404).json({ error: 'Ficha não encontrada.' });
  const character = result.rows[0];
  emitTable(req, tableId, 'character:updated', { character });
  res.json({ character });
});

router.delete('/:id/leave', async (req, res) => {
  const tableId = req.params.id;
  const tableResult = await query('select owner_id from tables where id = $1', [tableId]);
  if (!tableResult.rowCount) return res.status(404).json({ error: 'Campanha não encontrada.' });
  if (tableResult.rows[0].owner_id === req.user.id) {
    return res.status(400).json({ error: 'O dono deve excluir a mesa em vez de sair.' });
  }
  await query('delete from table_members where table_id = $1 and user_id = $2', [tableId, req.user.id]);
  const remaining = await query('select count(*)::int as total from table_members where table_id = $1', [tableId]);
  // v1.90.3: não limpar histórico enquanto ainda existir alguém vinculado à campanha.
  // O chat só é removido quando não sobrar nenhum membro na mesa.
  if ((remaining.rows[0]?.total || 0) <= 0) {
    await query('delete from chat_messages where table_id = $1', [tableId]);
    emitTable(req, tableId, 'messages:cleared', { reason: 'empty-table' });
  }
  emitTable(req, tableId, 'member:updated', { reason: 'leave' });
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  await query('delete from chat_messages where table_id = $1', [req.params.id]);
  const result = await query('delete from tables where id = $1 and owner_id = $2 returning id', [req.params.id, req.user.id]);
  if (!result.rowCount) return res.status(403).json({ error: 'Somente o dono pode excluir a mesa.' });
  emitTable(req, req.params.id, 'table:deleted', { reason: 'deleted' });
  res.json({ ok: true });
});


module.exports = require('../async-router')(router);
