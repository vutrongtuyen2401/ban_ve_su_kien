const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function parseZonedDateTime(value, label) {
  if (typeof value !== 'string' || !value.trim()) return { error: `${label} là bắt buộc.` };
  if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value.trim())) return { error: `${label} phải kèm múi giờ, ví dụ Z hoặc +07:00.` };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { error: `${label} không hợp lệ.` };
  return { date };
}

function validateEventInput(body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const venue = typeof body?.venue === 'string' ? body.venue.trim() : '';
  if (!title || title.length > 255) return { error: 'Tên sự kiện phải có từ 1 đến 255 ký tự.' };
  if (!description) return { error: 'Mô tả sự kiện là bắt buộc.' };
  if (!venue || venue.length > 255) return { error: 'Địa điểm phải có từ 1 đến 255 ký tự.' };
  return { value: { title, description, venue } };
}

function validateShowtimeInput(body, now = new Date()) {
  const start = parseZonedDateTime(body?.startsAt, 'Thời điểm bắt đầu');
  if (start.error) return start;
  if (start.date.getTime() <= now.getTime()) return { error: 'Thời điểm bắt đầu phải ở trong tương lai.' };

  let endsAt = null;
  if (body?.endsAt) {
    const end = parseZonedDateTime(body.endsAt, 'Thời điểm kết thúc');
    if (end.error) return end;
    if (end.date <= start.date) return { error: 'Thời điểm kết thúc phải sau thời điểm bắt đầu.' };
    endsAt = end.date;
  }

  const roomName = typeof body?.roomName === 'string' ? body.roomName.trim() : null;
  if (roomName?.length > 150) return { error: 'Tên phòng không được quá 150 ký tự.' };
  return { value: { startsAt: start.date, endsAt, roomName: roomName || null } };
}

function formatVietnam(date) {
  return new Intl.DateTimeFormat('vi-VN', { timeZone: VIETNAM_TIME_ZONE, dateStyle: 'short', timeStyle: 'medium', hour12: false }).format(date);
}

function toShowtimeResponse(row) {
  const startsAt = new Date(row.starts_at);
  const endsAt = row.ends_at ? new Date(row.ends_at) : null;
  return { id: row.id, eventId: row.event_id, startsAt: startsAt.toISOString(), endsAt: endsAt?.toISOString() || null, roomName: row.room_name, startsAtVietnam: formatVietnam(startsAt), endsAtVietnam: endsAt ? formatVietnam(endsAt) : null, timeZone: VIETNAM_TIME_ZONE };
}

function toEventResponse(row, showtimes) {
  const event = { id: row.id, title: row.title, description: row.description, venue: row.venue, status: row.status, ownerId: row.owner_id, createdAt: row.created_at, updatedAt: row.updated_at };
  if (showtimes) event.showtimes = showtimes.map(toShowtimeResponse);
  return event;
}

module.exports = { VIETNAM_TIME_ZONE, validateEventInput, validateShowtimeInput, toEventResponse, toShowtimeResponse };
