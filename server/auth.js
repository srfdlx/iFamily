const crypto = require('crypto');
const db = require('./db');
const config = require('./config');

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function randomInviteCode() {
  return crypto.randomBytes(6).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
}

async function createMagicLink(userId) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + config.magicLinkTtlMinutes * 60 * 1000);
  await db.query('INSERT INTO magic_links (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [
    userId,
    hashToken(token),
    expiresAt
  ]);
  return token;
}

async function consumeMagicLink(token) {
  const [rows] = await db.query(
    'SELECT id, user_id, expires_at, used_at FROM magic_links WHERE token_hash = ?',
    [hashToken(token)]
  );
  const link = rows[0];
  if (!link || link.used_at || new Date(link.expires_at) < new Date()) {
    return null;
  }
  await db.query('UPDATE magic_links SET used_at = NOW() WHERE id = ?', [link.id]);
  return link.user_id;
}

async function createSession(userId) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000);
  await db.query('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [
    userId,
    hashToken(token),
    expiresAt
  ]);
  return token;
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Nicht angemeldet.' });
  }
  const [rows] = await db.query(
    `SELECT s.expires_at, u.id, u.family_id, u.email, u.display_name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?`,
    [hashToken(token)]
  );
  const session = rows[0];
  if (!session || new Date(session.expires_at) < new Date()) {
    return res.status(401).json({ error: 'Sitzung abgelaufen. Bitte erneut anmelden.' });
  }
  req.user = {
    id: session.id,
    familyId: session.family_id,
    email: session.email,
    displayName: session.display_name
  };
  next();
}

module.exports = {
  randomInviteCode,
  createMagicLink,
  consumeMagicLink,
  createSession,
  requireAuth
};
