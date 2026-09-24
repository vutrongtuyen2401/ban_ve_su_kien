const nodemailer = require('nodemailer');

function smtpConfiguration() {
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  };
}

function assertEmailConfiguration() {
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') return;
  const required = ['APP_BASE_URL', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Thiếu cấu hình email bắt buộc: ${missing.join(', ')}`);
}

async function sendEmail({ to, subject, text, html }) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`\n[DEV EMAIL]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    return { development: true };
  }
  assertEmailConfiguration();
  const transporter = nodemailer.createTransport(smtpConfiguration());
  return transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text, html });
}

async function sendActivationEmail({ to, activationUrl }) {
  return sendEmail({
    to,
    subject: 'Xác nhận tài khoản bán vé sự kiện',
    text: `Vui lòng kích hoạt tài khoản trong 24 giờ: ${activationUrl}`,
    html: `<p>Vui lòng kích hoạt tài khoản trong 24 giờ:</p><p><a href="${activationUrl}">Kích hoạt tài khoản</a></p>`,
  });
}

module.exports = { assertEmailConfiguration, sendEmail, sendActivationEmail };
