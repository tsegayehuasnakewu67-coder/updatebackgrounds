require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { getSmtpConfigurationStatus, verifySmtpConnection } = require('../services/emailService');

const main = async () => {
  const { configured, missingVariables } = getSmtpConfigurationStatus();
  if (!configured) {
    console.error(`Email configuration incomplete. Set these keys in backEnd/.env: ${missingVariables.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  try {
    await verifySmtpConnection();
    console.log('SMTP connection verified. Credentials were not displayed.');
  } catch (error) {
    if (error.code === 'EAUTH') {
      console.error('SMTP authentication failed. For Gmail, use a Google App Password in SMTP_PASS.');
    } else if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET'].includes(error.code)) {
      console.error('SMTP connection failed. Check SMTP_HOST, SMTP_PORT, SMTP_SECURE, and network access.');
    } else {
      console.error(`SMTP verification failed (${error.code || 'unknown error'}). Check SMTP configuration.`);
    }
    process.exitCode = 1;
  }
};

main();