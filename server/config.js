require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  return value;
}

module.exports = {
  port: Number(required('PORT', 3000)),
  appUrl: required('APP_URL', 'http://localhost:3000'),

  db: {
    host: required('DB_HOST', 'localhost'),
    port: Number(required('DB_PORT', 3306)),
    user: required('DB_USER', 'ifamily'),
    password: required('DB_PASSWORD', ''),
    database: required('DB_NAME', 'ifamily')
  },

  sessionTtlDays: Number(required('SESSION_TTL_DAYS', 90)),
  magicLinkTtlMinutes: Number(required('MAGIC_LINK_TTL_MINUTES', 15)),

  smtp: {
    host: required('SMTP_HOST', ''),
    port: Number(required('SMTP_PORT', 587)),
    secure: required('SMTP_SECURE', 'false') === 'true',
    user: required('SMTP_USER', ''),
    password: required('SMTP_PASSWORD', ''),
    from: required('MAIL_FROM', 'iFamily <noreply@example.ch>')
  },

  vapid: {
    publicKey: required('VAPID_PUBLIC_KEY', ''),
    privateKey: required('VAPID_PRIVATE_KEY', ''),
    subject: required('VAPID_SUBJECT', 'mailto:noreply@example.ch')
  }
};
