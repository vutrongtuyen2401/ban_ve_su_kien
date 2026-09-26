const form = document.querySelector('#registerForm');
const message = document.querySelector('#message');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  if (values.password !== values.confirmation) { message.className = 'message error'; message.textContent = 'Mật khẩu nhập lại không khớp.'; return; }
  const button = form.querySelector('button'); button.disabled = true;
  try {
    const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: values.email, password: values.password }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    sessionStorage.setItem('registrationMessage', 'Đăng ký thành công. Hãy mở email và bấm liên kết xác nhận trước khi đăng nhập.');
    location.href = '/login.html';
  } catch (error) { message.className = 'message error'; message.textContent = error.message; button.disabled = false; }
});
