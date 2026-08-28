const nodemailer = require('nodemailer');
const config = require('./config');

const transporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined
    })
  : null;

async function sendMagicLink(email, link) {
  if (!transporter) {
    console.log(`[mailer] SMTP nicht konfiguriert. Magic-Link fuer ${email}: ${link}`);
    return;
  }
  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Dein Login-Link für iFamily',
    text: `Hallo!\n\nMit diesem Link kannst du dich bei iFamily anmelden:\n${link}\n\nDer Link ist ${config.magicLinkTtlMinutes} Minuten gültig. Falls du das nicht angefordert hast, ignoriere diese E-Mail einfach.`,
    html: `<p>Hallo!</p><p>Mit diesem Link kannst du dich bei <strong>iFamily</strong> anmelden:</p><p><a href="${link}">${link}</a></p><p>Der Link ist ${config.magicLinkTtlMinutes} Minuten gültig. Falls du das nicht angefordert hast, ignoriere diese E-Mail einfach.</p>`
  });
}

module.exports = { sendMagicLink };
