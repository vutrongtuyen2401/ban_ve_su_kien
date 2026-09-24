const { currentUser } = require('../services/sessionService');
async function loadUser(req, _res, next) { try { req.user = await currentUser(req); next(); } catch (error) { next(error); } }
function requireUser(req, res, next) { if (!req.user) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập.' }); next(); }
function requireOrganizer(req, res, next) { if (!req.user) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập.' }); if (!req.user.roles.some((r) => ['organizer', 'admin'].includes(r))) return res.status(403).json({ success: false, message: 'Chỉ ban tổ chức được thực hiện thao tác này.' }); next(); }
module.exports = { loadUser, requireUser, requireOrganizer };
