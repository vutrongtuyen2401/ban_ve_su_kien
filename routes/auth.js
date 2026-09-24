const express = require('express');
const argon2 = require('argon2');
const db = require('../db');
const { registerBuyer, activateAccount } = require('../services/authService');
const { createSession, destroySession, setSessionCookie, clearSessionCookie } = require('../services/sessionService');
const { requireUser } = require('../middleware/auth');

const router = express.Router();
const GENERIC_MESSAGE = 'Nếu email hợp lệ, bạn sẽ nhận được hướng dẫn xác nhận tài khoản.';

router.post('/register', async (req, res) => {
  try {
    await registerBuyer(req.body || {});
    return res.status(202).json({ success: true, message: GENERIC_MESSAGE });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ success: false, message: error.message });
    if (error.code === '23505') return res.status(202).json({ success: true, message: GENERIC_MESSAGE });
    console.error('Lỗi đăng ký:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
});

router.get('/activate', async (req, res) => {
  try {
    const result = await activateAccount(req.query.token);
    return res.status(result.status).json({ success: result.status === 200, code: result.code, message: result.message });
  } catch (error) {
    console.error('Lỗi kích hoạt tài khoản:', error.message);
    return res.status(500).json({ success: false, code: 'SERVER_ERROR', message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const user = await db('users').where({ email }).first();
    if (!user || !(await argon2.verify(user.password_hash, String(req.body?.password || '')))) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không đúng.' });
    }
    if (!user.is_active) return res.status(403).json({ success: false, message: 'Tài khoản chưa được xác nhận qua email.' });
    const session = await createSession(user.id);
    setSessionCookie(res, session);
    return res.json({ success: true, user: { id: user.id, email: user.email } });
  } catch (error) { return next(error); }
});

router.post('/logout', requireUser, async (req, res, next) => {
  try { await destroySession(req); clearSessionCookie(res); return res.json({ success: true }); }
  catch (error) { return next(error); }
});

router.get('/me', requireUser, (req, res) => res.json({ success: true, user: req.user }));

module.exports = router;
