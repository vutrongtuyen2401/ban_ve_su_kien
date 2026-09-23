const crypto = require('crypto');

const ACTIVATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createActivationToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');

  return {
    rawToken,
    tokenHash: hashValue(rawToken),
    expiresAt: new Date(Date.now() + ACTIVATION_LIFETIME_MS),
  };
}

function createActivationUrl(rawToken) {
  const baseUrl = String(process.env.APP_BASE_URL || '').replace(/\/$/, '');

  if (!baseUrl) {
    throw new Error('APP_BASE_URL chưa được cấu hình');
  }

  return `${baseUrl}/api/auth/activate?token=${encodeURIComponent(rawToken)}`;
}

module.exports = {
  createActivationToken,
  createActivationUrl,
  hashValue,
};
