const crypto = require('crypto');

const TOKEN_DURATION_MS = 24 * 60 * 60 * 1000;

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function createActivationToken(now = new Date()) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return { rawToken, tokenHash: hashToken(rawToken), expiresAt: new Date(now.getTime() + TOKEN_DURATION_MS) };
}

function createActivationUrl(rawToken) {
  const baseUrl = (process.env.APP_BASE_URL || 'http://localhost:8090').replace(/\/$/, '');
  return `${baseUrl}/activate.html?token=${encodeURIComponent(rawToken)}`;
}

module.exports = { TOKEN_DURATION_MS, hashToken, createActivationToken, createActivationUrl };
