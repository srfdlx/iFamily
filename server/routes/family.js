const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const [familyRows] = await db.query('SELECT id, name, invite_code FROM families WHERE id = ?', [
    req.user.familyId
  ]);
  const [members] = await db.query(
    'SELECT id, display_name, email FROM users WHERE family_id = ? ORDER BY display_name',
    [req.user.familyId]
  );
  res.json({
    id: familyRows[0].id,
    name: familyRows[0].name,
    inviteCode: familyRows[0].invite_code,
    members
  });
});

router.patch('/', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Name darf nicht leer sein.' });
  }
  await db.query('UPDATE families SET name = ? WHERE id = ?', [name, req.user.familyId]);
  res.json({ ok: true });
});

module.exports = router;
