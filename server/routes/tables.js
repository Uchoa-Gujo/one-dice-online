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
  for (let i = 0; i < 20; i += 1) {
    const code = makeInviteCode();
    const exists = await query('select id from tables where invite_code = $1', [code]);
    if (!exists.rowCount) return code;
  }
  throw new Error('Não foi possível gerar código de convite.');
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
  const name = String(req.body.name || 'Nova Mesa').trim();
  const code = await uniqueInviteCode();
  const created = await query(
    'insert into tables (name, owner_id, invite_code) values ($1, $2, $3) returning *',
    [name, req.user.id, code]
  );
  const table = created.rows[0];
  await query('insert into table_members (table_id, user_id, role) values ($1, $2, $3)', [table.id, req.user.id, 'master']);
  res.json({ table });
});

router.post('/join', async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const characterId = req.body.characterId || null;
  const found = await query('select * from tables where invite_code = $1', [code]);
  if (!found.rowCount) return res.status(404).json({ error: 'Mesa não encontrada.' });
  const table = found.rows[0];

  const role = table.owner_id === req.user.id ? 'master_player' : 'player';
  await query(`
    insert into table_members (table_id, user_id, role, character_id)
    values ($1, $2, $3, $4)
    on conflict (table_id, user_id)
    do update set character_id = excluded.character_id,
                  role = case when table_members.role = 'master' and excluded.role = 'master_player' then 'master_player' else table_members.role end,
                  updated_at = now()
  `, [table.id, req.user.id, role, characterId]);

  res.json({ table, role });
});

router.delete('/:id', async (req, res) => {
  const result = await query('delete from tables where id = $1 and owner_id = $2 returning id', [req.params.id, req.user.id]);
  if (!result.rowCount) return res.status(403).json({ error: 'Somente o dono pode excluir a mesa.' });
  res.json({ ok: true });
});

module.exports = router;
