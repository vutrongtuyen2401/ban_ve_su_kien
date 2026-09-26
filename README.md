# Bán vé sự kiện — Sprint 1

Ứng dụng Express/PostgreSQL gồm đăng ký và xác nhận tài khoản, đăng nhập theo vai trò, quản lý sự kiện và suất diễn, sơ đồ ghế và giữ ghế trong 10 phút.

## Cách chạy thống nhất cho cả nhóm (khuyến nghị)

Yêu cầu duy nhất: Docker Desktop đang chạy.

```bash
git switch integration/sprint-1
docker compose up --build
```

Docker tự động tạo database Sprint 1 riêng, chạy migration, seed tài khoản demo và khởi động ứng dụng. Không cần tạo `.env` khi chạy bằng Docker.

Mở http://localhost:8090/login.html hoặc http://localhost:8090/register.html.

Tài khoản demo ban tổ chức:

```text
Email: organizer@demo.local
Mật khẩu: OrganizerDemo123!
```

Tài khoản admin:

```text
Email: admin@demo.local
Mật khẩu: AdminDemo123!
```

Ở chế độ development, liên kết xác nhận tài khoản đăng ký mới được in trong log container API:

```bash
docker compose logs -f api
```

Dừng ứng dụng nhưng giữ dữ liệu:

```bash
docker compose down
```

Chỉ khi dữ liệu demo không cần giữ, có thể tạo lại database sạch:

```bash
docker compose down -v
docker compose up --build
```

Lệnh `down -v` xóa volume database Docker của Sprint 1, không tác động database PostgreSQL cài trực tiếp trên máy.

## Chạy không dùng Docker

Yêu cầu Node.js 20+ và PostgreSQL 15+.

```bash
cp .env.example .env
npm ci
npm run setup:dev
npm test
npm start
```

Trên PowerShell, dùng `Copy-Item .env.example .env` thay cho lệnh `cp`. Mỗi thành viên cần tạo database mới và cập nhật `DB_CONNECTION_STRING` trong `.env`. Không commit `.env`.

## Kiểm thử

```bash
npm test
```

Bộ kiểm thử xác minh kích hoạt tài khoản, quyền sở hữu sự kiện, thời gian suất diễn, hết hạn giữ ghế và tình huống 200 yêu cầu cạnh tranh trên 100 ghế.

## Quy ước Git

- Phát triển và kiểm thử Sprint 1 trên `integration/sprint-1`.
- Không merge thêm nhánh Task 9 cũ vì schema Task 9 đã được tích hợp trong Task 10.
- Chỉ tạo Pull Request từ `integration/sprint-1` vào `main` sau khi Docker và `npm test` đều chạy thành công.
- Không commit `.env`, mật khẩu thật hoặc thông tin SMTP thật.
