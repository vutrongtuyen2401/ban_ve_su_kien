const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEventInput, validateShowtimeInput, toShowtimeResponse } = require('../services/eventService');

test('chuẩn hóa dữ liệu sự kiện hợp lệ', () => {
  assert.deepEqual(validateEventInput({ title: ' Đêm nhạc ', description: ' Mô tả ', venue: ' Hà Nội ' }), { value: { title: 'Đêm nhạc', description: 'Mô tả', venue: 'Hà Nội' } });
});

test('chặn suất diễn trong quá khứ với lý do rõ ràng', () => {
  const result = validateShowtimeInput({ startsAt: '2026-09-23T20:00:00+07:00' }, new Date('2026-09-24T00:00:00Z'));
  assert.match(result.error, /tương lai/);
});

test('không chấp nhận thời gian thiếu múi giờ', () => {
  const result = validateShowtimeInput({ startsAt: '2026-09-25T20:00:00' }, new Date('2026-09-24T00:00:00Z'));
  assert.match(result.error, /múi giờ/);
});

test('trả thời gian UTC và giờ Việt Nam', () => {
  const value = toShowtimeResponse({ id: 1, event_id: 2, starts_at: '2026-09-25T13:00:00.000Z', ends_at: null, room_name: 'Phòng A' });
  assert.equal(value.startsAt, '2026-09-25T13:00:00.000Z');
  assert.match(value.startsAtVietnam, /20:00:00/);
  assert.equal(value.timeZone, 'Asia/Ho_Chi_Minh');
});
