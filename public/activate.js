const message = document.querySelector('#message');
(async () => {
  const token = new URLSearchParams(location.search).get('token');
  if (!token) { message.className = 'message error'; message.textContent = 'Liên kết xác nhận không hợp lệ.'; return; }
  try {
    const response = await fetch(`/api/auth/activate?token=${encodeURIComponent(token)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    message.className = 'message success'; message.textContent = 'Tài khoản đã được xác nhận. Bạn có thể đăng nhập ngay.';
  } catch (error) { message.className = 'message error'; message.textContent = error.message; }
})();
