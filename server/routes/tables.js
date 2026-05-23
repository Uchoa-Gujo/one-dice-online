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

function apiRole(role) {
  if (role === 'mestre') return 'master';
  if (role === 'jogador') return 'player';
  if (role === 'mestre_jogador') return 'master_player';
  return role;
}

router.get('/', async (req, res) => {
  const result = await query(`
    select t.*, tm.role, tm.character_id
    from table_members tm
    join tables t on t.id = tm.table_id
    where tm.user_id = $1
    order by t.updated_at desc
  `, [req.user.id]);
  res.json({ tables: result.rows });
});

router.post('/', async (req, res) => {
  const name = String(req.body.name || 'Nova Mesa').trim().slice(0, 80) || 'Nova Mesa';
  const code = await uniqueInviteCode();

  const created = await query(
    'insert into tables (name, owner_id, invite_code) values ($1, $2, $3) returning *',
    [name, req.user.id, code]
  );
  const table = created.rows[0];

  await query(
    `insert into table_members (table_id, user_id, role)
     values ($1, $2, 'master')
     on conflict (table_id, user_id) do nothing`,
    [table.id, req.user.id]
  );

  res.json({ table });
});

router.post('/join', async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const characterId = req.body.characterId || null;

  if (!/^[A-Z]{5}$/.test(code)) {
    return res.status(400).json({ error: 'Código inválido.' });
  }

  const found = await query('select * from tables where invite_code = $1', [code]);
  if (!found.rowCount) return res.status(404).json({ error: 'Mesa não encontrada.' });
  const table = found.rows[0];

  const wantedRole = table.owner_id === req.user.id ? 'master_player' : 'player';

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

  res.json({ table, role: wantedRole });
});

router.get('/:id/state', async (req, res) => {
  const tableId = req.params.id;
  const isMember = await query('select id from table_members where table_id = $1 and user_id = $2', [tableId, req.user.id]);
  if (!isMember.rowCount) return res.status(403).json({ error: 'Você não faz parte desta mesa.' });

  const tableResult = await query('select * from tables where id = $1', [tableId]);
  if (!tableResult.rowCount) return res.status(404).json({ error: 'Mesa não encontrada.' });

  const members = await query(`
    select tm.*, u.nick, u.real_name, c.name as character_name, c.data as character_data
    from table_members tm
    join users u on u.id = tm.user_id
    left join characters c on c.id = tm.character_id
    where tm.table_id = $1
    order by tm.created_at asc
  `, [tableId]);

  res.json({ table: tableResult.rows[0], members: members.rows });
});

router.put('/:id/member', async (req, res) => {
  const tableId = req.params.id;
  const characterId = req.body.characterId || null;

  if (characterId) {
    const own = await query('select id from characters where id = $1 and owner_id = $2', [characterId, req.user.id]);
    if (!own.rowCount) return res.status(403).json({ error: 'Essa ficha não pertence a você.' });
  }

  const tableResult = await query('select * from tables where id = $1', [tableId]);
  if (!tableResult.rowCount) return res.status(404).json({ error: 'Mesa não encontrada.' });
  const table = tableResult.rows[0];

  const existing = await query('select * from table_members where table_id = $1 and user_id = $2', [tableId, req.user.id]);
  if (!existing.rowCount) return res.status(403).json({ error: 'Você não faz parte desta mesa.' });

  let role = existing.rows[0].role;
  if (table.owner_id === req.user.id && role === 'master' && characterId) role = 'master_player';

  const updated = await query(`
    update table_members
    set character_id = $1, role = $2, updated_at = now()
    where table_id = $3 and user_id = $4
    returning *
  `, [characterId, role, tableId, req.user.id]);

  res.json({ member: updated.rows[0] });
});

router.delete('/:id/leave', async (req, res) => {
  const tableId = req.params.id;
  const tableResult = await query('select owner_id from tables where id = $1', [tableId]);
  if (!tableResult.rowCount) return res.status(404).json({ error: 'Mesa não encontrada.' });
  if (tableResult.rows[0].owner_id === req.user.id) {
    return res.status(400).json({ error: 'O dono deve excluir a mesa em vez de sair.' });
  }
  await query('delete from table_members where table_id = $1 and user_id = $2', [tableId, req.user.id]);
  res.json({ ok: true });
});

router.delete('/:id', async (req, res) => {
  const result = await query('delete from tables where id = $1 and owner_id = $2 returning id', [req.params.id, req.user.id]);
  if (!result.rowCount) return res.status(403).json({ error: 'Somente o dono pode excluir a mesa.' });
  res.json({ ok: true });
});

module.exports = router;
