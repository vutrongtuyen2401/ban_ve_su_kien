const form = document.querySelector('#loginForm');
const message = document.querySelector('#message');
const registered = sessionStorage.getItem('registrationMessage');
if (registered) { message.className = 'message success'; message.textContent = registered; sessionStorage.removeItem('registrationMessage'); }
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button'); button.disabled = true;
  try {
    const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    message.className = 'message success'; message.textContent = 'Đăng nhập thành công, đang chuyển trang…';
    const roles = data.user.roles || [];
    location.href = roles.some((role) => ['organizer', 'admin'].includes(role)) ? '/organizer-events.html' : '/home.html';
  } catch (error) { message.className = 'message error'; message.textContent = error.message; button.disabled = false; }
});
