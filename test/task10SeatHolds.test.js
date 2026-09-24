const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const argon2 = require('argon2');
const db = require('../db');
const app = require('../app');
const { createSession, COOKIE_NAME } = require('../services/sessionService');
const { holdSeat, cleanupExpiredHolds, SeatConflictError, HOLD_MS } = require('../services/seatHoldService');

test('Task 10: sự kiện, suất diễn, sơ đồ ghế và giữ ghế đồng thời', async (t) => {
  const suffix = crypto.randomBytes(4).toString('hex');
  const passwordHash = await argon2.hash('StrongPass123!');
  const roleRows = await db('roles').insert([{ name: 'organizer' }, { name: 'buyer' }]).onConflict('name').ignore().returning('*');
  void roleRows;
  const roles = Object.fromEntries((await db('roles').whereIn('name', ['organizer', 'buyer'])).map((r) => [r.name, r.id]));
  const [owner, other, buyerA, buyerB] = await db('users').insert(['owner', 'other', 'buyer-a', 'buyer-b'].map((name) => ({ email: `${name}-${suffix}@test.local`, password_hash: passwordHash, is_active: true }))).returning('*');
  await db('user_roles').insert([{ user_id: owner.id, role_id: roles.organizer }, { user_id: other.id, role_id: roles.organizer }, { user_id: buyerA.id, role_id: roles.buyer }, { user_id: buyerB.id, role_id: roles.buyer }]);
  const ownerSession = await createSession(owner.id);
  const otherSession = await createSession(other.id);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, token, options = {}) => fetch(base + path, { ...options, headers: { 'content-type': 'application/json', cookie: `${COOKIE_NAME}=${token}`, ...(options.headers || {}) } });
  let eventId; let showtimeId; let seatIds = [];
  try {
    await t.test('sự kiện mặc định nháp, có chủ sở hữu và tài khoản khác bị từ chối', async () => {
      const created = await request('/api/events', ownerSession.token, { method: 'POST', body: JSON.stringify({ title: 'Đêm nhạc', description: 'Mô tả', venue: 'Nhà hát' }) });
      assert.equal(created.status, 201);
      const body = await created.json(); eventId = body.event.id;
      assert.equal(body.event.status, 'draft'); assert.equal(body.event.owner_id, owner.id);
      const publicEvents = await (await fetch(`${base}/api/events/public`)).json();
      assert.equal(publicEvents.events.some((event) => event.id === eventId), false);
      assert.equal((await request(`/api/events/${eventId}`, otherSession.token)).status, 403);
    });

    await t.test('chặn quá khứ, cho phép trùng giờ và trả cảnh báo', async () => {
      const past = await request(`/api/events/${eventId}/showtimes`, ownerSession.token, { method: 'POST', body: JSON.stringify({ startsAt: new Date(Date.now() - 60_000) }) });
      assert.equal(past.status, 400);
      const startsAt = new Date(Date.now() + 86_400_000).toISOString();
      const first = await request(`/api/events/${eventId}/showtimes`, ownerSession.token, { method: 'POST', body: JSON.stringify({ startsAt, roomName: 'A' }) });
      assert.equal(first.status, 201); showtimeId = (await first.json()).showtime.id;
      const second = await request(`/api/events/${eventId}/showtimes`, ownerSession.token, { method: 'POST', body: JSON.stringify({ startsAt, roomName: 'B' }) });
      assert.equal(second.status, 201); assert.match((await second.json()).warning, /trùng thời gian/);
    });

    await t.test('200 yêu cầu cho 100 ghế chỉ tạo đúng 100 lượt giữ', async () => {
      const seats = Array.from({ length: 100 }, (_, i) => ({ seat_code: `T${i + 1}`, row_label: 'T', seat_number: i + 1 }));
      const inserted = await db('seats').insert(seats).returning('id'); seatIds = inserted.map((s) => s.id);
      await db('showtime_seats').insert(seatIds.map((seatId) => ({ showtime_id: showtimeId, seat_id: seatId })));
      const attempts = seatIds.flatMap((seatId) => [holdSeat({ showtimeId, seatId, userId: buyerA.id }), holdSeat({ showtimeId, seatId, userId: buyerB.id })]);
      const results = await Promise.allSettled(attempts);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 100);
      const rejected = results.filter((r) => r.status === 'rejected');
      assert.equal(rejected.length, 100); assert.ok(rejected.every((r) => r.reason instanceof SeatConflictError));
      assert.equal(Number((await db('seat_holds').where({ showtime_id: showtimeId, status: 'ACTIVE' }).count('* as count').first()).count), 100);
      const hold = await db('seat_holds').where({ showtime_id: showtimeId }).first();
      const lifetime = new Date(hold.expires_at) - new Date(hold.created_at);
      assert.ok(lifetime >= HOLD_MS - 1500 && lifetime <= HOLD_MS + 1500);
    });

    await t.test('ghế hết hạn được trả về AVAILABLE; ghế SOLD bị từ chối', async () => {
      const hold = await db('seat_holds').where({ showtime_id: showtimeId }).first();
      await db('seat_holds').where({ id: hold.id }).update({ expires_at: new Date(Date.now() - 1000) });
      assert.equal(await cleanupExpiredHolds(), 1);
      assert.equal((await db('showtime_seats').where({ id: hold.showtime_seat_id }).first()).status, 'AVAILABLE');
      await db('showtime_seats').where({ id: hold.showtime_seat_id }).update({ status: 'SOLD' });
      await assert.rejects(() => holdSeat({ showtimeId, seatId: hold.seat_id, userId: buyerB.id }), SeatConflictError);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await db('events').where({ id: eventId }).del();
    if (seatIds.length) await db('seats').whereIn('id', seatIds).del();
    await db('users').whereIn('id', [owner.id, other.id, buyerA.id, buyerB.id]).del();
    await db.destroy();
  }
});
