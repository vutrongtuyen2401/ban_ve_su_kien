const events = document.querySelector('#events');
const account = document.querySelector('#account');
const logout = document.querySelector('#logout');
async function start() {
  const me = await fetch('/api/auth/me');
  if (!me.ok) { location = '/login.html'; return; }
  const profile = await me.json(); account.textContent = profile.user.email;
  if (profile.user.roles.some((role) => ['organizer', 'admin'].includes(role))) { location = '/organizer-events.html'; return; }
  const response = await fetch('/api/events/public'); const data = await response.json();
  if (!data.events.length) { events.textContent = 'Hiện chưa có sự kiện nào được mở bán.'; return; }
  events.innerHTML = '';
  for (const event of data.events) { const card = document.createElement('article'); card.className = 'event-card'; const title = document.createElement('h2'); title.textContent = event.title; const detail = document.createElement('p'); detail.textContent = `${event.venue} — ${event.description || 'Chưa có mô tả'}`; card.append(title, detail); events.append(card); }
}
logout.onclick = async () => { await fetch('/api/auth/logout', { method: 'POST' }); location = '/login.html'; };
start().catch(() => { events.className = 'message error'; events.textContent = 'Không thể tải trang chủ.'; });
