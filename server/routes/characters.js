const express = require('express');
const { query } = require('../database');
const { authRequired } = require('../middleware');

const router = express.Router();
router.use(authRequired);

router.get('/', async (req, res) => {
  const result = await query(
    'select id, name, data, created_at, updated_at from characters where owner_id = $1 order by updated_at desc',
    [req.user.id]
  );
  res.json({ characters: result.rows });
});

router.post('/', async (req, res) => {
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
  res.json({ character: result.rows[0] });
});

router.delete('/:id', async (req, res) => {
  const result = await query('delete from characters where id = $1 and owner_id = $2 returning id', [req.params.id, req.user.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Ficha não encontrada.' });
  res.json({ ok: true });
});

module.exports = router;
