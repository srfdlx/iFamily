const webpush = require('web-push');
const config = require('./config');
const db = require('./db');

if (config.vapid.publicKey && config.vapid.privateKey) {
  webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
}

async function sendToUser(userId, payload) {
  if (!config.vapid.publicKey || !config.vapid.privateKey) {
    console.log('[push] VAPID nicht konfiguriert, ueberspringe Push.', payload);
    return;
  }
  const [subs] = await db.query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?', [userId]);
  await Promise.all(
    subs.map(async (sub) => {
      const subscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      };
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
        } else {
          console.error('[push] Fehler beim Senden:', err.message);
        }
      }
    })
  );
}

module.exports = { sendToUser };
