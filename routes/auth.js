const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { sendActivationEmail } = require('../services/emailService');
const {
  createActivationToken,
  createActivationUrl,
  hashValue,
} = require('../services/activationTokenService');

const router = express.Router();
const BCRYPT_ROUNDS = 12;
const GENERIC_REGISTRATION_MESSAGE =
  'Nếu email hợp lệ, bạn sẽ nhận được hướng dẫn xác nhận tài khoản.';
const GENERIC_RESEND_MESSAGE =
  'Nếu tài khoản cần kích hoạt, bạn sẽ nhận được email hướng dẫn.';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateRegistrationInput(body) {
  const { email, password, fullName } = body || {};

  if (typeof email !== 'string' || typeof password !== 'string' || typeof fullName !== 'string') {
    return 'Email, mật khẩu và họ tên phải là chuỗi.';
  }

  const normalizedEmail = normalizeEmail(email);
  const trimmedFullName = fullName.trim();

  if (!trimmedFullName || trimmedFullName.length < 2 || trimmedFullName.length > 150) {
    return 'Họ tên phải có từ 2 đến 150 ký tự.';
  }

  if (normalizedEmail.length > 320 || !isValidEmail(normalizedEmail)) {
    return 'Email không hợp lệ.';
  }

  if (password.length < 8 || password.length > 128) {
    return 'Mật khẩu phải có từ 8 đến 128 ký tự.';
  }

  return null;
}

async function createTokenRecord(trx, userId) {
  const activationToken = createActivationToken();

  await trx('email_activation_tokens').insert({
    user_id: userId,
    token_hash: activationToken.tokenHash,
    expires_at: activationToken.expiresAt,
  });

  return activationToken;
}

async function deliverActivationEmail(user, rawToken) {
  await sendActivationEmail({
    to: user.email,
    fullName: user.full_name,
    activationUrl: createActivationUrl(rawToken),
  });
}

router.post('/register', async (req, res) => {
  const validationError = validateRegistrationInput(req.body);

  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  const normalizedEmail = normalizeEmail(req.body.email);
  const fullName = req.body.fullName.trim();

  try {
    const existingUser = await db('users').where({ email: normalizedEmail }).first('id');

    if (existingUser) {
      return res.status(202).json({ success: true, message: GENERIC_REGISTRATION_MESSAGE });
    }

    const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);
    const result = await db.transaction(async (trx) => {
      const [user] = await trx('users')
        .insert({
          email: normalizedEmail,
          password_hash: passwordHash,
          full_name: fullName,
          role: 'buyer',
          is_active: false,
        })
        .returning(['id', 'email', 'full_name']);

      const activationToken = await createTokenRecord(trx, user.id);
      return { user, rawToken: activationToken.rawToken };
    });

    try {
      await deliverActivationEmail(result.user, result.rawToken);
    } catch (emailError) {
      console.error('Không thể gửi email kích hoạt:', emailError.message);
    }

    return res.status(202).json({ success: true, message: GENERIC_REGISTRATION_MESSAGE });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(202).json({ success: true, message: GENERIC_REGISTRATION_MESSAGE });
    }

    console.error('Lỗi đăng ký:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
});

function sendActivationResult(req, res, status, code, message) {
  if (req.accepts(['html', 'json']) === 'html') {
    const resendLink = code === 'TOKEN_EXPIRED'
      ? '<p><a href="/resend-activation.html">Gửi lại liên kết kích hoạt</a></p>'
      : '';

    return res.status(status).send(`<!doctype html>
      <html lang="vi">
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Kích hoạt tài khoản</title></head>
        <body style="font-family:Arial,sans-serif;max-width:640px;margin:80px auto;padding:24px">
          <h1>Kích hoạt tài khoản</h1><p>${message}</p>${resendLink}
          <p><a href="/">Quay lại trang đăng ký</a></p>
        </body>
      </html>`);
  }

  return res.status(status).json({ success: status < 400, code, message });
}

router.get('/activate', async (req, res) => {
  const rawToken = typeof req.query.token === 'string' ? req.query.token : '';

  if (!/^[a-f0-9]{64}$/i.test(rawToken)) {
    return sendActivationResult(req, res, 400, 'TOKEN_INVALID', 'Liên kết kích hoạt không hợp lệ.');
  }

  try {
    const result = await db.transaction(async (trx) => {
      const tokenRecord = await trx('email_activation_tokens')
        .where({ token_hash: hashValue(rawToken) })
        .forUpdate()
        .first();

      if (!tokenRecord) {
        return { status: 400, code: 'TOKEN_INVALID', message: 'Liên kết kích hoạt không hợp lệ.' };
      }

      if (tokenRecord.used_at) {
        return { status: 409, code: 'TOKEN_USED', message: 'Liên kết kích hoạt đã được sử dụng.' };
      }

      if (tokenRecord.revoked_at) {
        return { status: 410, code: 'TOKEN_REPLACED', message: 'Liên kết này đã được thay thế. Vui lòng dùng email kích hoạt mới nhất.' };
      }

      if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) {
        return { status: 410, code: 'TOKEN_EXPIRED', message: 'Liên kết kích hoạt đã hết hạn. Vui lòng yêu cầu liên kết mới.' };
      }

      await trx('users').where({ id: tokenRecord.user_id }).update({
        is_active: true,
        email_verified_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });

      await trx('email_activation_tokens').where({ id: tokenRecord.id }).update({
        used_at: trx.fn.now(),
      });

      return { status: 200, code: 'ACCOUNT_ACTIVATED', message: 'Tài khoản đã được kích hoạt thành công.' };
    });

    return sendActivationResult(req, res, result.status, result.code, result.message);
  } catch (error) {
    console.error('Lỗi kích hoạt tài khoản:', error.message);
    return sendActivationResult(req, res, 500, 'SERVER_ERROR', 'Lỗi hệ thống. Vui lòng thử lại sau.');
  }
});

router.post('/resend-activation', async (req, res) => {
  if (typeof req.body?.email !== 'string') {
    return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
  }

  const normalizedEmail = normalizeEmail(req.body.email);

  if (normalizedEmail.length > 320 || !isValidEmail(normalizedEmail)) {
    return res.status(400).json({ success: false, message: 'Email không hợp lệ.' });
  }

  const recipientHash = hashValue(normalizedEmail);

  try {
    const result = await db.transaction(async (trx) => {
      const advisoryLockKey = BigInt(`0x${recipientHash.slice(0, 15)}`).toString();
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [advisoryLockKey]);

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const countResult = await trx('email_delivery_attempts')
        .where({ recipient_hash: recipientHash, purpose: 'activation-resend' })
        .where('created_at', '>=', oneHourAgo)
        .count('* as total')
        .first();

      if (Number(countResult.total) >= 5) {
        return { limited: true };
      }

      await trx('email_delivery_attempts').insert({
        recipient_hash: recipientHash,
        purpose: 'activation-resend',
      });

      const user = await trx('users')
        .where({ email: normalizedEmail })
        .first(['id', 'email', 'full_name', 'is_active']);

      if (!user || user.is_active) {
        return { limited: false };
      }

      await trx('email_activation_tokens')
        .where({ user_id: user.id })
        .whereNull('used_at')
        .whereNull('revoked_at')
        .update({ revoked_at: trx.fn.now() });

      const activationToken = await createTokenRecord(trx, user.id);
      return { limited: false, user, rawToken: activationToken.rawToken };
    });

    if (result.limited) {
      return res.status(429).json({
        success: false,
        message: 'Bạn đã yêu cầu quá nhiều lần. Vui lòng thử lại sau.',
      });
    }

    if (result.user) {
      try {
        await deliverActivationEmail(result.user, result.rawToken);
      } catch (emailError) {
        console.error('Không thể gửi lại email kích hoạt:', emailError.message);
      }
    }

    return res.status(202).json({ success: true, message: GENERIC_RESEND_MESSAGE });
  } catch (error) {
    console.error('Lỗi gửi lại liên kết:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
});

router.post('/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email) : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const invalidCredentials = {
    success: false,
    code: 'INVALID_CREDENTIALS',
    message: 'Email hoặc mật khẩu không đúng.',
  };

  if (!email || !password) {
    return res.status(401).json(invalidCredentials);
  }

  try {
    const user = await db('users').where({ email }).first();

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json(invalidCredentials);
    }

    if (!user.is_active || !user.email_verified_at) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_NOT_ACTIVATED',
        message: 'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email hoặc yêu cầu gửi lại liên kết.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công.',
      user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
    });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
});

module.exports = router;
