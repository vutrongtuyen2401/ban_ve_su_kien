const express = require('express');
const db = require('../db');
const { requireOrganizer } = require('../middleware/eventAuthorization');
const { validateEventInput, validateShowtimeInput, toEventResponse, toShowtimeResponse } = require('../services/eventService');

const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const rows = await db('events').where({ status: 'published' }).orderBy('created_at', 'desc');
    return res.json({ success: true, data: rows.map((row) => toEventResponse(row)) });
  } catch (error) { return next(error); }
});

router.post('/', requireOrganizer, async (req, res, next) => {
  const validation = validateEventInput(req.body);
  if (validation.error) return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: validation.error });
  try {
    const [row] = await db('events').insert({ ...validation.value, owner_id: req.user.id, status: 'draft' }).returning('*');
    return res.status(201).json({ success: true, data: toEventResponse(row) });
  } catch (error) { return next(error); }
});

router.get('/:eventId', requireOrganizer, async (req, res, next) => {
  try {
    const event = await db('events').where({ id: req.params.eventId }).first();
    if (!event) return res.status(404).json({ success: false, code: 'EVENT_NOT_FOUND', message: 'Không tìm thấy sự kiện.' });
    if (event.owner_id !== req.user.id) return res.status(403).json({ success: false, code: 'EVENT_FORBIDDEN', message: 'Bạn không có quyền truy cập sự kiện của ban tổ chức khác.' });
    const showtimes = await db('showtimes').where({ event_id: event.id }).orderBy('starts_at');
    return res.json({ success: true, data: toEventResponse(event, showtimes) });
  } catch (error) { return next(error); }
});

router.post('/:eventId/showtimes', requireOrganizer, async (req, res, next) => {
  const validation = validateShowtimeInput(req.body);
  if (validation.error) return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: validation.error });
  try {
    const event = await db('events').where({ id: req.params.eventId }).first(['id', 'owner_id']);
    if (!event) return res.status(404).json({ success: false, code: 'EVENT_NOT_FOUND', message: 'Không tìm thấy sự kiện.' });
    if (event.owner_id !== req.user.id) return res.status(403).json({ success: false, code: 'EVENT_FORBIDDEN', message: 'Bạn không có quyền thêm suất diễn vào sự kiện của ban tổ chức khác.' });

    const duplicateQuery = db('showtimes').where({ event_id: event.id, starts_at: validation.value.startsAt });
    validation.value.endsAt ? duplicateQuery.where({ ends_at: validation.value.endsAt }) : duplicateQuery.whereNull('ends_at');
    const duplicate = await duplicateQuery.first('id');
    const [row] = await db('showtimes').insert({ event_id: event.id, starts_at: validation.value.startsAt, ends_at: validation.value.endsAt, room_name: validation.value.roomName }).returning('*');
    return res.status(201).json({ success: true, data: toShowtimeResponse(row), warning: duplicate ? 'Suất diễn trùng hoàn toàn thời gian với một suất khác; hệ thống vẫn lưu để hỗ trợ diễn song song ở nhiều phòng.' : null });
  } catch (error) { return next(error); }
});

module.exports = router;
