const nodemailer = require('nodemailer');

const normalizeEnvValue = (value) => (typeof value === 'string' ? value.trim() : '');

const getSmtpConfiguration = () => {
  const config = {
    host: normalizeEnvValue(process.env.SMTP_HOST || process.env.MAIL_HOST),
    port: Number.parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT, 10),
    secureValue: normalizeEnvValue(process.env.SMTP_SECURE || process.env.MAIL_SECURE).toLowerCase(),
    user: normalizeEnvValue(process.env.SMTP_USER || process.env.MAIL_USER),
    pass: normalizeEnvValue(process.env.SMTP_PASS || process.env.MAIL_PASSWORD),
    from: normalizeEnvValue(process.env.EMAIL_FROM || process.env.MAIL_FROM),
  };
  const missingVariables = [];
  if (!config.host) missingVariables.push('SMTP_HOST');
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) missingVariables.push('SMTP_PORT');
  if (!['true', 'false'].includes(config.secureValue)) missingVariables.push('SMTP_SECURE');
  if (!config.user) missingVariables.push('SMTP_USER');
  if (!config.pass) missingVariables.push('SMTP_PASS');
  if (!config.from) missingVariables.push('EMAIL_FROM');
  return {
    configured: missingVariables.length === 0,
    missingVariables,
    config: {
      host: config.host,
      port: config.port,
      secure: config.secureValue === 'true',
      user: config.user,
      pass: config.pass,
      from: config.from,
    },
  };
};

const getSmtpConfigurationStatus = () => {
  const { configured, missingVariables } = getSmtpConfiguration();
  return { configured, missingVariables };
};

const isPasswordResetEmailConfigured = () => getSmtpConfiguration().configured;
const isEmailConfigured = () => getSmtpConfiguration().configured;

const createTransport = () => {
  const { configured, missingVariables, config } = getSmtpConfiguration();
  if (!configured) {
    const error = new Error(`Email service configuration is missing: ${missingVariables.join(', ')}.`);
    error.code = 'SMTP_NOT_CONFIGURED';
    error.missingVariables = missingVariables;
    throw error;
  }
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
  });
};

const sendChecked = async (mail) => {
  const transporter = createTransport();
  const result = await transporter.sendMail({ ...mail, from: getSmtpConfiguration().config.from });
  if ((Array.isArray(result.rejected) && result.rejected.length > 0)
    || (Array.isArray(result.accepted) && result.accepted.length === 0)) {
    const error = new Error('The email provider rejected the message.');
    error.code = 'SMTP_DELIVERY_REJECTED';
    throw error;
  }
  return result;
};

const verifySmtpConnection = async () => {
  const transporter = createTransport();
  await transporter.verify();
  return true;
};

const sendPasswordResetEmail = async ({ email, name, token }) => {
  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const resetUrl = `${clientUrl}/reset-password?token=${encodeURIComponent(token)}`;
  return sendChecked({
    to: email,
    subject: 'Smart Attendance password reset',
    text: `Hello ${name || 'there'},\n\nUse this single-use link within 15 minutes to reset your password:\n${resetUrl}\n\nIf you did not request this, you can ignore this message.`,
  });
};

const sendPasswordResetCodeEmail = async ({ email, name, code }) => {
  return sendChecked({
    to: email,
    subject: 'Smart Attendance verification code',
    text: `Hello ${name || 'there'},\n\nYour password reset verification code is ${code}. It expires in 10 minutes. If you did not request this, you can ignore this message.`,
  });
};

const sendContactReplyEmail = async ({ email, name, subject, originalMessage, reply, ticketId }) => {
  return sendChecked({
    to: email,
    subject: `Re: ${String(subject || '').replace(/[\r\n]+/g, ' ')}${ticketId ? ` [${ticketId}]` : ''}`,
    text: `Hello ${name || 'there'},\n\nWe have replied to your contact ticket${ticketId ? ` ${ticketId}` : ''}.\n\nYour original message:\n${originalMessage || '(Original message unavailable)'}\n\nOur reply:\n${reply}\n\nMekdela Amba University Smart Attendance Support`,
  });
};

module.exports = {
  sendPasswordResetEmail,
  sendPasswordResetCodeEmail,
  sendContactReplyEmail,
  verifySmtpConnection,
  getSmtpConfigurationStatus,
  isPasswordResetEmailConfigured,
  isEmailConfigured,
};
