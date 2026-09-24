const express = require('express');
const db = require('../db');
const { requireOrganizer } = require('../middleware/auth');

const router = express.Router();

router.get('/public', async (_req, res, next) => {
  try {
    const events = await db('events').where({ status: 'published' }).orderBy('created_at', 'desc');
    return res.json({ success: true, events });
  } catch (error) { return next(error); }
});

router.use(requireOrganizer);

function eventData(body) {
  const title = String(body.title || '').trim();
  const venue = String(body.venue || '').trim();
  const description = String(body.description || '').trim();
  if (!title || title.length > 255) throw Object.assign(new Error('Tên sự kiện là bắt buộc và không quá 255 ký tự.'), { status: 400 });
  if (!venue || venue.length > 255) throw Object.assign(new Error('Địa điểm là bắt buộc và không quá 255 ký tự.'), { status: 400 });
  return { title, venue, description: description || null };
}

async function ownedEvent(id, userId) {
  return db('events').where({ id, owner_id: userId }).first();
}

router.get('/', async (req, res, next) => {
  try {
    const events = await db('events').where({ owner_id: req.user.id }).orderBy('created_at', 'desc');
    return res.json({ success: true, events });
  } catch (error) { return next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const [event] = await db('events').insert({ ...eventData(req.body || {}), owner_id: req.user.id, status: 'draft' }).returning('*');
    return res.status(201).json({ success: true, event });
  } catch (error) { if (error.status) return res.status(error.status).json({ success: false, message: error.message }); return next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const event = await ownedEvent(req.params.id, req.user.id);
    if (!event) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem sự kiện này.' });
    const showtimes = await db('showtimes').where({ event_id: event.id }).orderBy('starts_at');
    return res.json({ success: true, event, showtimes });
  } catch (error) { return next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!(await ownedEvent(req.params.id, req.user.id))) return res.status(403).json({ success: false, message: 'Bạn không có quyền sửa sự kiện này.' });
    const [event] = await db('events').where({ id: req.params.id }).update({ ...eventData(req.body || {}), updated_at: db.fn.now() }).returning('*');
    return res.json({ success: true, event });
  } catch (error) { if (error.status) return res.status(error.status).json({ success: false, message: error.message }); return next(error); }
});

router.post('/:id/showtimes', async (req, res, next) => {
  try {
    const event = await ownedEvent(req.params.id, req.user.id);
    if (!event) return res.status(403).json({ success: false, message: 'Bạn không có quyền thêm suất diễn cho sự kiện này.' });
    const startsAt = new Date(req.body?.startsAt);
    if (!Number.isFinite(startsAt.getTime())) return res.status(400).json({ success: false, message: 'Thời điểm bắt đầu không hợp lệ.' });
    if (startsAt.getTime() <= Date.now()) return res.status(400).json({ success: false, message: 'Thời điểm bắt đầu phải ở trong tương lai.' });
    const duplicate = await db('showtimes').where({ event_id: event.id, starts_at: startsAt }).first('id');
    const [showtime] = await db('showtimes').insert({ event_id: event.id, starts_at: startsAt, room_name: String(req.body?.roomName || '').trim() || null }).returning('*');
    return res.status(201).json({ success: true, showtime, warning: duplicate ? 'Suất diễn trùng thời gian với một suất khác; đã lưu vì có thể diễn song song ở hai phòng.' : null });
  } catch (error) { return next(error); }
});

module.exports = router;
