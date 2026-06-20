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

function emitTable(req, tableId, eventName, payload = {}) {
  const io = req.app.get('io');
  if (io) io.to(`table:${tableId}`).emit(eventName, { tableId, ...payload });
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
    set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{drops}', $1::jsonb, true), updated_at = now()
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

router.get('/', async (req, res) => {
  const result = await query(`
    select t.*, tm.role, tm.character_id,
      (select count(*)::int from table_members where table_id = t.id) as player_count
    from table_members tm
    join tables t on t.id = tm.table_id
    where tm.user_id = $1
    order by lower(t.name) asc, t.updated_at desc
  `, [req.user.id]);
  res.json({ tables: result.rows });
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

  emitTable(req, table.id, 'member:updated', { reason: 'join' });
  res.json({ table, role: wantedRole });
});

router.get('/:id/state', async (req, res) => {
  const tableId = req.params.id;
  const isMember = await query('select id from table_members where table_id = $1 and user_id = $2', [tableId, req.user.id]);
  if (!isMember.rowCount) return res.status(403).json({ error: 'Você não participa desta campanha.' });

  const tableResult = await query('select * from tables where id = $1', [tableId]);
  if (!tableResult.rowCount) return res.status(404).json({ error: 'Campanha não encontrada.' });

  const members = await query(`
    select tm.*, u.nick, u.real_name, u.avatar_url, c.name as character_name, c.data as character_data
    from table_members tm
    join users u on u.id = tm.user_id
    left join characters c on c.id = tm.character_id
    where tm.table_id = $1
    order by lower(coalesce(c.name, u.real_name, u.nick)) asc, tm.created_at asc
  `, [tableId]);

  res.json({ table: tableResult.rows[0], members: members.rows });
});


router.put('/:id', requireTableMaster, async (req, res) => {
  const tableId = req.params.id;
  const name = String(req.body.name || 'Campanha').trim().slice(0, 80) || 'Campanha';
  const description = String(req.body.description || '').trim().slice(0, 200);
  const logoUrl = String(req.body.logoUrl || req.body.logo_url || '').trim().slice(0, 200000);
  const currentTable = await query('select settings from tables where id = $1 and owner_id = $2', [tableId, req.user.id]);
  const previousSettings = currentTable.rows[0]?.settings || {};
  const systemModel = normalizeSystemModel(req.body.systemType || req.body.systemModel || req.body?.settings?.systemType || req.body?.settings?.systemModel || previousSettings.systemType || previousSettings.systemModel);
  const settings = { ...previousSettings, ...(req.body.settings && typeof req.body.settings === 'object' ? req.body.settings : {}), systemType: systemModel, systemModel };

  const result = await query(`
    update tables
    set name = $1, description = $2, logo_url = $3, settings = $4, updated_at = now()
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
    set character_id = $1, role = $2, updated_at = now()
    where table_id = $3 and user_id = $4
    returning *
  `, [characterId, role, tableId, req.user.id]);

  emitTable(req, tableId, 'member:updated', { reason: 'character-linked', member: updated.rows[0] });
  res.json({ member: updated.rows[0] });
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
  const updatedFrom = await query('update characters set data = $1, updated_at = now() where id = $2 returning *', [fromData, fromCharacterId]);

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
  const updatedTo = await query('update characters set data = $1, updated_at = now() where id = $2 returning *', [toData, toCharacterId]);
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

  const updatedFrom = await query('update characters set data = $1, updated_at = now() where id = $2 returning *', [fromData, fromCharacterId]);
  const updatedTo = await query('update characters set data = $1, updated_at = now() where id = $2 returning *', [toData, toCharacterId]);

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
    set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{initiative}', $1::jsonb, true), updated_at = now()
    where id = $2
    returning settings
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
    'update characters set name = $1, data = $2, updated_at = now() where id = $3 returning *',
    [name, data, characterId]
  );
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
  if ((remaining.rows[0]?.total || 0) <= 1) {
    await query('delete from chat_messages where table_id = $1', [tableId]);
    emitTable(req, tableId, 'messages:cleared', { reason: 'last-player-left' });
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
