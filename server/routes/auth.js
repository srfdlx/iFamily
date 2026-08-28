const express = require('express');
const db = require('../db');
const { randomInviteCode, createMagicLink, consumeMagicLink, createSession, requireAuth } = require('../auth');
const { sendMagicLink } = require('../mailer');
const config = require('../config');

const router = express.Router();

router.post('/request-link', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const displayName = String(req.body.displayName || '').trim();
  const inviteCode = String(req.body.inviteCode || '').trim().toUpperCase();

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' });
  }

  const [existingRows] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  let userId = existingRows[0]?.id;

  if (!userId) {
    if (!displayName) {
      return res.status(400).json({ error: 'Bitte einen Namen angeben.' });
    }

    let familyId;
    if (inviteCode) {
      const [familyRows] = await db.query('SELECT id FROM families WHERE invite_code = ?', [inviteCode]);
      if (!familyRows[0]) {
        return res.status(400).json({ error: 'Einladungscode ungültig.' });
      }
      familyId = familyRows[0].id;
    } else {
      const [familyResult] = await db.query('INSERT INTO families (name, invite_code) VALUES (?, ?)', [
        `Familie ${displayName}`,
        randomInviteCode()
      ]);
      familyId = familyResult.insertId;
    }

    const [userResult] = await db.query(
      'INSERT INTO users (family_id, email, display_name) VALUES (?, ?, ?)',
      [familyId, email, displayName]
    );
    userId = userResult.insertId;
  }

  const token = await createMagicLink(userId);
  const link = `${config.appUrl}/auth/verify.html?token=${token}`;
  await sendMagicLink(email, link);

  res.json({ ok: true });
});

router.post('/verify', async (req, res) => {
  const token = String(req.body.token || '');
  const userId = await consumeMagicLink(token);
  if (!userId) {
    return res.status(400).json({ error: 'Link ist ungültig oder abgelaufen.' });
  }
  const sessionToken = await createSession(userId);
  const [rows] = await db.query(
    'SELECT id, family_id, email, display_name FROM users WHERE id = ?',
    [userId]
  );
  res.json({
    sessionToken,
    user: {
      id: rows[0].id,
      familyId: rows[0].family_id,
      email: rows[0].email,
      displayName: rows[0].display_name
    }
  });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
