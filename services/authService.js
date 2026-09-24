const argon2 = require('argon2');
const db = require('../db');
const { createActivationToken, createActivationUrl, hashToken } = require('./activationTokenService');
const { sendActivationEmail } = require('./emailService');

async function registerBuyer({ email, password }, { deliver = sendActivationEmail } = {}) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw Object.assign(new Error('Email không hợp lệ.'), { status: 400 });
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw Object.assign(new Error('Mật khẩu phải có từ 8 đến 128 ký tự.'), { status: 400 });
  const exists = await db('users').where({ email: normalizedEmail }).first('id');
  if (exists) return { accepted: true, existing: true };

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const token = createActivationToken();
  const user = await db.transaction(async (trx) => {
    const [created] = await trx('users').insert({ email: normalizedEmail, password_hash: passwordHash, is_active: false }).returning(['id', 'email']);
    const buyerRole = await trx('roles').where({ name: 'buyer' }).first('id');
    if (!buyerRole) throw new Error('Vai trò buyer chưa được khởi tạo. Hãy chạy seed trước.');
    await trx('user_roles').insert({ user_id: created.id, role_id: buyerRole.id });
    await trx('account_activation_tokens').insert({ user_id: created.id, token_hash: token.tokenHash, expires_at: token.expiresAt });
    return created;
  });

  try {
    await deliver({ to: user.email, activationUrl: createActivationUrl(token.rawToken), userId: user.id });
  } catch (error) {
    console.error(`Không thể gửi email kích hoạt cho user_id=${user.id}:`, error.message);
  }
  return { accepted: true, userId: user.id };
}

async function activateAccount(rawToken, now = new Date()) {
  if (!/^[a-f0-9]{64}$/i.test(String(rawToken || ''))) return { status: 400, code: 'TOKEN_INVALID', message: 'Liên kết kích hoạt không hợp lệ.' };
  return db.transaction(async (trx) => {
    const record = await trx('account_activation_tokens').where({ token_hash: hashToken(rawToken) }).forUpdate().first();
    if (!record) return { status: 400, code: 'TOKEN_INVALID', message: 'Liên kết kích hoạt không hợp lệ.' };
    if (record.used_at) return { status: 409, code: 'TOKEN_USED', message: 'Liên kết kích hoạt đã được sử dụng.' };
    if (new Date(record.expires_at).getTime() <= now.getTime()) return { status: 410, code: 'TOKEN_EXPIRED', message: 'Liên kết kích hoạt đã hết hạn.' };
    await trx('users').where({ id: record.user_id }).update({ is_active: true, email_verified_at: trx.fn.now(), updated_at: trx.fn.now() });
    await trx('account_activation_tokens').where({ id: record.id }).update({ used_at: trx.fn.now() });
    return { status: 200, code: 'ACCOUNT_ACTIVATED', message: 'Tài khoản đã được kích hoạt thành công.' };
  });
}

module.exports = { registerBuyer, activateAccount };
