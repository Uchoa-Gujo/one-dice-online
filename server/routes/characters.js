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
