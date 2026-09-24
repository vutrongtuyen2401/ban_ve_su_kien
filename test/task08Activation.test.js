const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const argon2 = require('argon2');
const db = require('../db');
const { registerBuyer, activateAccount } = require('../services/authService');
const { hashToken } = require('../services/activationTokenService');
const { sendActivationEmail } = require('../services/emailService');
const app = require('../app');

test('Task 08: đăng ký, email và activation an toàn', async (t) => {
  const suffix = crypto.randomBytes(5).toString('hex');
  const emails = [];
  await db('roles').insert({ name: 'buyer' }).onConflict('name').ignore();

  async function register(email, password = 'StrongPass123!') {
    let activationUrl;
    await registerBuyer({ email, password }, { deliver: async (mail) => { activationUrl = mail.activationUrl; } });
    emails.push(email);
    return { rawToken: new URL(activationUrl).searchParams.get('token'), password };
  }

  try {
    await t.test('registration tạo user inactive, Argon2id và token hash 24 giờ', async () => {
      const email = `t08-${suffix}@test.local`;
      const { rawToken, password } = await register(email);
      const user = await db('users').where({ email }).first();
      const token = await db('account_activation_tokens').where({ user_id: user.id }).first();
      assert.equal(user.is_active, false);
      assert.match(user.password_hash, /^\$argon2id\$/);
      assert.equal(await argon2.verify(user.password_hash, password), true);
      assert.notEqual(token.token_hash, rawToken);
      assert.equal(token.token_hash, hashToken(rawToken));
      const lifetime = new Date(token.expires_at) - new Date(token.created_at);
      assert.ok(lifetime >= 24 * 60 * 60 * 1000 - 1000 && lifetime <= 24 * 60 * 60 * 1000 + 1000);

      const first = await activateAccount(rawToken);
      const second = await activateAccount(rawToken);
      assert.equal(first.status, 200);
      assert.equal(second.code, 'TOKEN_USED');
      const activated = await db('users').where({ id: user.id }).first();
      assert.equal(activated.is_active, true);
      assert.ok(activated.email_verified_at);
    });

    await t.test('token hết hạn và token sai bị từ chối sạch', async () => {
      const email = `t08-expired-${suffix}@test.local`;
      const { rawToken } = await register(email);
      const user = await db('users').where({ email }).first();
      await db('account_activation_tokens').where({ user_id: user.id }).update({ expires_at: new Date(Date.now() - 1000) });
      assert.equal((await activateAccount(rawToken)).code, 'TOKEN_EXPIRED');
      assert.equal((await activateAccount(crypto.randomBytes(32).toString('hex'))).code, 'TOKEN_INVALID');
      assert.equal((await db('users').where({ id: user.id }).first()).is_active, false);
    });

    await t.test('hai activation đồng thời chỉ một request thành công', async () => {
      const email = `t08-race-${suffix}@test.local`;
      const { rawToken } = await register(email);
      const results = await Promise.all([activateAccount(rawToken), activateAccount(rawToken)]);
      assert.equal(results.filter((result) => result.status === 200).length, 1);
      assert.equal(results.filter((result) => result.code === 'TOKEN_USED').length, 1);
    });

    await t.test('endpoint activation trả đúng success, used và invalid', async () => {
      const email = `t08-api-${suffix}@test.local`;
      const { rawToken } = await register(email);
      const server = app.listen(0);
      await new Promise((resolve) => server.once('listening', resolve));
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      try {
        const first = await fetch(`${baseUrl}/api/auth/activate?token=${rawToken}`);
        const firstBody = await first.json();
        assert.equal(first.status, 200);
        assert.equal(firstBody.code, 'ACCOUNT_ACTIVATED');
        const second = await fetch(`${baseUrl}/api/auth/activate?token=${rawToken}`);
        assert.equal(second.status, 409);
        assert.equal((await second.json()).code, 'TOKEN_USED');
        const invalid = await fetch(`${baseUrl}/api/auth/activate?token=invalid`);
        assert.equal(invalid.status, 400);
        assert.equal((await invalid.json()).code, 'TOKEN_INVALID');
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    await t.test('development log recipient và URL; staging/production không log token', async () => {
      const originalEnvironment = process.env.NODE_ENV;
      const originalLog = console.log;
      const messages = [];
      console.log = (...parts) => messages.push(parts.join(' '));
      try {
        process.env.NODE_ENV = 'development';
        const secret = crypto.randomBytes(16).toString('hex');
        await sendActivationEmail({ to: 'buyer@test.local', activationUrl: `http://localhost/activate?token=${secret}` });
        assert.match(messages.join('\n'), /buyer@test\.local/);
        assert.match(messages.join('\n'), new RegExp(secret));
        messages.length = 0;
        for (const environment of ['staging', 'production']) {
          process.env.NODE_ENV = environment;
          await assert.rejects(() => sendActivationEmail({ to: 'buyer@test.local', activationUrl: `http://localhost/activate?token=${secret}` }));
          assert.equal(messages.join('\n').includes(secret), false);
        }
      } finally {
        console.log = originalLog;
        process.env.NODE_ENV = originalEnvironment;
      }
    });
  } finally {
    await db('users').whereIn('email', emails).del();
    await db.destroy();
  }
});
