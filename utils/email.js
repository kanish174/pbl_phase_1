let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (error) {
  nodemailer = null;
}

function smtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.EMAIL_FROM
  );
}

async function sendEmployeeCredentialsEmail({ to, username, temporaryPassword }) {
  const subject = 'Your Performance Review System Login Credentials';
  const text = [
    'Your employee account has been created by HR.',
    '',
    `Username: ${username}`,
    `Temporary Password: ${temporaryPassword}`,
    '',
    'Please log in and change your password immediately.',
  ].join('\n');

  if (!nodemailer || !smtpConfigured()) {
    console.warn(`[email] Could not send credentials to ${to}. Missing nodemailer dependency or SMTP configuration.`);
    console.warn(`[email] Credentials generated for ${username}.`);
    return { sent: false, reason: 'Email transport is not configured' };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
  });

  return { sent: true };
}

module.exports = {
  sendEmployeeCredentialsEmail,
};
