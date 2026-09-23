const nodemailer = require('nodemailer');

let smtpTransporter;

function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

function assertEmailConfiguration() {
  if (!process.env.APP_BASE_URL) {
    throw new Error('Thiếu cấu hình APP_BASE_URL');
  }

  if (isDevelopment()) {
    return;
  }

  const requiredVariables = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'];
  const missingVariables = requiredVariables.filter((name) => !process.env[name]);

  if (missingVariables.length > 0) {
    throw new Error(`Thiếu cấu hình SMTP: ${missingVariables.join(', ')}`);
  }
}

function getSmtpTransporter() {
  if (!smtpTransporter) {
    assertEmailConfiguration();
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  return smtpTransporter;
}

async function sendEmail({ to, subject, text, html, attachments }) {
  if (isDevelopment()) {
    console.log('\n========== DEV EMAIL ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    console.log('===============================\n');
    return { developmentPreview: true };
  }

  return getSmtpTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
    html,
    attachments,
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function sendActivationEmail({ to, fullName, activationUrl }) {
  const safeName = escapeHtml(fullName);
  const safeUrl = escapeHtml(activationUrl);
  const subject = 'Xác nhận tài khoản bán vé sự kiện';
  const text = [
    `Chào ${fullName},`,
    '',
    'Vui lòng xác nhận tài khoản bằng liên kết dưới đây:',
    activationUrl,
    '',
    'Liên kết có hiệu lực trong 24 giờ và chỉ sử dụng được một lần.',
    'Nếu bạn không thực hiện đăng ký này, hãy bỏ qua email.',
  ].join('\n');
  const html = `
    <p>Chào ${safeName},</p>
    <p>Vui lòng xác nhận tài khoản bằng nút dưới đây:</p>
    <p><a href="${safeUrl}">Kích hoạt tài khoản</a></p>
    <p>Liên kết có hiệu lực trong 24 giờ và chỉ sử dụng được một lần.</p>
    <p>Nếu bạn không thực hiện đăng ký này, hãy bỏ qua email.</p>
  `;

  return sendEmail({ to, subject, text, html });
}

module.exports = {
  assertEmailConfiguration,
  sendEmail,
  sendActivationEmail,
};
