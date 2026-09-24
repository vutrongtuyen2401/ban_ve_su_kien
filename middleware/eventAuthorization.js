const db = require('../db');

async function requireOrganizer(req, res, next) {
  // T-09 nhận req.user từ middleware đăng nhập/phân quyền khi tích hợp T-05/T-06.
  // Header chỉ hỗ trợ chạy độc lập ở development và bị vô hiệu hóa trong production.
  const userId = req.user?.id || (process.env.NODE_ENV !== 'production' ? Number(req.get('x-user-id')) : null);
  if (!Number.isSafeInteger(Number(userId)) || Number(userId) <= 0) {
    return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Vui lòng đăng nhập.' });
  }

  try {
    const user = await db('users').where({ id: Number(userId), is_active: true }).first(['id', 'role']);
    if (!user) return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Tài khoản không hợp lệ hoặc chưa kích hoạt.' });
    if (user.role !== 'organizer' && user.role !== 'admin') return res.status(403).json({ success: false, code: 'ORGANIZER_REQUIRED', message: 'Chỉ ban tổ chức được thực hiện thao tác này.' });
    req.user = { ...req.user, ...user };
    return next();
  } catch (error) { return next(error); }
}

module.exports = { requireOrganizer };
