const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createActivationToken,
  createActivationUrl,
  hashValue,
} = require('../services/activationTokenService');

test('tạo token ngẫu nhiên đủ dài, chỉ lưu hash và hết hạn sau 24 giờ', () => {
  const before = Date.now();
  const first = createActivationToken();
  const second = createActivationToken();

  assert.match(first.rawToken, /^[a-f0-9]{64}$/);
  assert.equal(first.tokenHash.length, 64);
  assert.equal(first.tokenHash, hashValue(first.rawToken));
  assert.notEqual(first.rawToken, second.rawToken);
  assert.ok(first.expiresAt.getTime() >= before + 24 * 60 * 60 * 1000);
  assert.ok(first.expiresAt.getTime() <= Date.now() + 24 * 60 * 60 * 1000);
});

test('tạo URL kích hoạt từ APP_BASE_URL', () => {
  const previousBaseUrl = process.env.APP_BASE_URL;
  process.env.APP_BASE_URL = 'http://localhost:8090/';

  assert.equal(
    createActivationUrl('abc123'),
    'http://localhost:8090/api/auth/activate?token=abc123',
  );

  process.env.APP_BASE_URL = previousBaseUrl;
});
