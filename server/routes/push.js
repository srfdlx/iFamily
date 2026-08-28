const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const config = require('../config');

const router = express.Router();

router.get('/public-key', (req, res) => {
  res.json({ publicKey: config.vapid.publicKey });
});

router.use(requireAuth);

router.post('/subscribe', async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: 'Ungültiges Subscription-Objekt.' });
  }
  await db.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
    [req.user.id, endpoint, keys.p256dh, keys.auth]
  );
  res.status(201).json({ ok: true });
});

router.delete('/subscribe', async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint fehlt.' });
  }
  await db.query('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', [endpoint, req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
