# Bán vé sự kiện

## Chạy ở môi trường development

```powershell
npm install
npm run migrate:latest
npm start
```

Mở `http://localhost:8090`. Khi đăng ký, email xác nhận và liên kết kích hoạt được in trong terminal; development không gửi email thật.

## API tài khoản

- `POST /api/auth/register`: đăng ký tài khoản người mua.
- `GET /api/auth/activate?token=...`: kích hoạt tài khoản; token hết hạn sau 24 giờ và chỉ dùng một lần.
- `POST /api/auth/resend-activation`: gửi lại liên kết, tối đa 5 lần mỗi giờ cho một email.
- `POST /api/auth/login`: đăng nhập; tài khoản chưa kích hoạt nhận mã `ACCOUNT_NOT_ACTIVATED`.

## Email dùng chung

`services/emailService.js` cung cấp `sendEmail()` để E-11 dùng lại cho email vé và thông báo. `sendActivationEmail()` là template dành riêng cho kích hoạt tài khoản.

Chỉ `NODE_ENV=development` được phép log nội dung email. Staging và production bắt buộc có `APP_BASE_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` và `SMTP_FROM`; thiếu biến thì server từ chối khởi động.

Không commit file `.env` hoặc thông tin SMTP thật.
