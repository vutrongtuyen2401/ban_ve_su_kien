const db = require('../db');
const HOLD_MS = 10 * 60 * 1000;
class SeatConflictError extends Error {}
async function cleanupExpiredHolds() {
  return db.transaction(async (trx) => {
    const rows = await trx('seat_holds').where({ status: 'ACTIVE' }).where('expires_at', '<=', trx.fn.now()).forUpdate().select('*');
    if (!rows.length) return 0;
    await trx('showtime_seats').whereIn('id', rows.map((r) => r.showtime_seat_id)).where({ status: 'HELD' }).update({ status: 'AVAILABLE', updated_at: trx.fn.now() });
    await trx('seat_holds').whereIn('id', rows.map((r) => r.id)).update({ status: 'EXPIRED', updated_at: trx.fn.now() });
    return rows.length;
  });
}
async function holdSeat({ showtimeId, seatId, userId }) {
  return db.transaction(async (trx) => {
    const clockResult = await trx.raw("SELECT CURRENT_TIMESTAMP AS now, CURRENT_TIMESTAMP + INTERVAL '10 minutes' AS expires_at");
    const clock = clockResult.rows[0];
    const link = await trx('showtime_seats').where({ showtime_id: showtimeId, seat_id: seatId }).forUpdate().first();
    if (!link) throw Object.assign(new Error('Ghế không thuộc suất diễn này.'), { code: 'NOT_FOUND' });
    if (link.status === 'SOLD') throw new SeatConflictError('Ghế đã được bán.');
    const old = await trx('seat_holds').where({ showtime_seat_id: link.id }).first();
    const active = old && old.status === 'ACTIVE' && new Date(old.expires_at) > new Date(clock.now);
    if (active && old.user_id !== userId) throw new SeatConflictError('Ghế đang được khách hàng khác giữ.');
    if (active) return { ...old, reused: true };
    const values = { user_id: userId, status: 'ACTIVE', expires_at: clock.expires_at, updated_at: trx.fn.now() };
    const [hold] = old ? await trx('seat_holds').where({ id: old.id }).update(values).returning('*') : await trx('seat_holds').insert({ ...values, showtime_seat_id: link.id, showtime_id: showtimeId, seat_id: seatId }).returning('*');
    await trx('showtime_seats').where({ id: link.id }).update({ status: 'HELD', updated_at: trx.fn.now() });
    return hold;
  });
}
async function seatMap(showtimeId, userId) {
  await cleanupExpiredHolds();
  const rows = await db('showtime_seats as ss').join('seats', 'seats.id', 'ss.seat_id').leftJoin('seat_holds as h', function () { this.on('h.showtime_seat_id', '=', 'ss.id').andOnVal('h.status', '=', 'ACTIVE'); }).where('ss.showtime_id', showtimeId).orderBy(['seats.row_label', 'seats.seat_number']).select('seats.*', 'ss.status', 'h.user_id as held_by', 'h.expires_at');
  return rows.map((r) => ({ id: r.id, seatCode: r.seat_code, row: r.row_label, number: r.seat_number, status: r.status, heldByCurrentUser: r.held_by === userId, expiresAt: r.held_by === userId ? r.expires_at : null }));
}
module.exports = { HOLD_MS, SeatConflictError, cleanupExpiredHolds, holdSeat, seatMap };
