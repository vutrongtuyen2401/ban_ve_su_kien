const express = require('express');
const db = require('../db');
const { requireUser, requireOrganizer } = require('../middleware/auth');
const { SeatConflictError, holdSeat, seatMap } = require('../services/seatHoldService');

const router = express.Router();

async function showtimeWithEvent(id) {
  return db('showtimes as s').join('events as e', 'e.id', 's.event_id').where('s.id', id).first('s.*', 'e.owner_id', 'e.status as event_status', 'e.title as event_title');
}

router.post('/:id/seats', requireOrganizer, async (req, res, next) => {
  try {
    const showtime = await showtimeWithEvent(req.params.id);
    if (!showtime || showtime.owner_id !== req.user.id) return res.status(403).json({ success: false, message: 'Bạn không có quyền tạo sơ đồ ghế cho suất diễn này.' });
    const rows = Number(req.body?.rows); const seatsPerRow = Number(req.body?.seatsPerRow);
    if (!Number.isInteger(rows) || !Number.isInteger(seatsPerRow) || rows < 1 || rows > 26 || seatsPerRow < 1 || seatsPerRow > 100) return res.status(400).json({ success: false, message: 'Số hàng phải từ 1–26 và số ghế mỗi hàng từ 1–100.' });
    const result = await db.transaction(async (trx) => {
      const exists = await trx('showtime_seats').where({ showtime_id: showtime.id }).first('id');
      if (exists) throw Object.assign(new Error('Suất diễn đã có sơ đồ ghế.'), { status: 409 });
      const seats = [];
      for (let row = 0; row < rows; row += 1) for (let number = 1; number <= seatsPerRow; number += 1) seats.push({ seat_code: `${String.fromCharCode(65 + row)}${number}`, row_label: String.fromCharCode(65 + row), seat_number: number });
      const inserted = await trx('seats').insert(seats).returning('id');
      await trx('showtime_seats').insert(inserted.map((seat) => ({ showtime_id: showtime.id, seat_id: seat.id })));
      return inserted.length;
    });
    return res.status(201).json({ success: true, count: result });
  } catch (error) { if (error.status) return res.status(error.status).json({ success: false, message: error.message }); return next(error); }
});

router.get('/:id/seats', requireUser, async (req, res, next) => {
  try {
    const showtime = await showtimeWithEvent(req.params.id);
    if (!showtime) return res.status(404).json({ success: false, message: 'Không tìm thấy suất diễn.' });
    if (showtime.event_status === 'draft' && showtime.owner_id !== req.user.id) return res.status(403).json({ success: false, message: 'Sự kiện nháp chưa mở cho người mua.' });
    return res.json({ success: true, showtime, seats: await seatMap(showtime.id, req.user.id), serverTime: new Date().toISOString() });
  } catch (error) { return next(error); }
});

router.post('/:id/holds', requireUser, async (req, res, next) => {
  try {
    const showtime = await showtimeWithEvent(req.params.id);
    if (!showtime) return res.status(404).json({ success: false, message: 'Không tìm thấy suất diễn.' });
    if (showtime.event_status === 'draft' && showtime.owner_id !== req.user.id) return res.status(403).json({ success: false, message: 'Sự kiện nháp chưa mở cho người mua.' });
    const hold = await holdSeat({ showtimeId: showtime.id, seatId: Number(req.body?.seatId), userId: req.user.id });
    return res.status(hold.reused ? 200 : 201).json({ success: true, hold: { id: hold.id, expiresAt: hold.expires_at }, message: 'Giữ ghế thành công trong 10 phút.' });
  } catch (error) {
    if (error instanceof SeatConflictError) return res.status(409).json({ success: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ success: false, message: error.message });
    return next(error);
  }
});

module.exports = router;
