const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const [lists] = await db.query(
    'SELECT id, name, created_by, created_at FROM lists WHERE family_id = ? ORDER BY created_at',
    [req.user.familyId]
  );
  const [items] = await db.query(
    `SELECT li.id, li.list_id, li.text, li.checked, li.added_by, li.created_at
     FROM list_items li JOIN lists l ON l.id = li.list_id
     WHERE l.family_id = ? ORDER BY li.created_at`,
    [req.user.familyId]
  );
  const itemsByList = new Map();
  for (const item of items) {
    if (!itemsByList.has(item.list_id)) itemsByList.set(item.list_id, []);
    itemsByList.get(item.list_id).push(item);
  }
  res.json({
    lists: lists.map((list) => ({ ...list, items: itemsByList.get(list.id) || [] }))
  });
});

router.post('/', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Name darf nicht leer sein.' });
  }
  const [result] = await db.query('INSERT INTO lists (family_id, name, created_by) VALUES (?, ?, ?)', [
    req.user.familyId,
    name,
    req.user.id
  ]);
  res.status(201).json({ id: result.insertId });
});

router.delete('/:id', async (req, res) => {
  await db.query('DELETE FROM lists WHERE id = ? AND family_id = ?', [req.params.id, req.user.familyId]);
  res.json({ ok: true });
});

async function assertListInFamily(listId, familyId) {
  const [rows] = await db.query('SELECT id FROM lists WHERE id = ? AND family_id = ?', [listId, familyId]);
  return Boolean(rows[0]);
}

router.post('/:id/items', async (req, res) => {
  if (!(await assertListInFamily(req.params.id, req.user.familyId))) {
    return res.status(404).json({ error: 'Liste nicht gefunden.' });
  }
  const text = String(req.body.text || '').trim();
  if (!text) {
    return res.status(400).json({ error: 'Text darf nicht leer sein.' });
  }
  const [result] = await db.query('INSERT INTO list_items (list_id, text, added_by) VALUES (?, ?, ?)', [
    req.params.id,
    text,
    req.user.id
  ]);
  res.status(201).json({ id: result.insertId });
});

router.patch('/:id/items/:itemId', async (req, res) => {
  if (!(await assertListInFamily(req.params.id, req.user.familyId))) {
    return res.status(404).json({ error: 'Liste nicht gefunden.' });
  }
  const fields = [];
  const params = [];
  if (req.body.text !== undefined) {
    fields.push('text = ?');
    params.push(String(req.body.text).trim());
  }
  if (req.body.checked !== undefined) {
    fields.push('checked = ?');
    params.push(req.body.checked ? 1 : 0);
  }
  if (!fields.length) {
    return res.json({ ok: true });
  }
  params.push(req.params.itemId, req.params.id);
  await db.query(`UPDATE list_items SET ${fields.join(', ')} WHERE id = ? AND list_id = ?`, params);
  res.json({ ok: true });
});

router.delete('/:id/items/:itemId', async (req, res) => {
  if (!(await assertListInFamily(req.params.id, req.user.familyId))) {
    return res.status(404).json({ error: 'Liste nicht gefunden.' });
  }
  await db.query('DELETE FROM list_items WHERE id = ? AND list_id = ?', [req.params.itemId, req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
