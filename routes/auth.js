const express = require('express');
const { registerBuyer, activateAccount } = require('../services/authService');

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

module.exports = router;
