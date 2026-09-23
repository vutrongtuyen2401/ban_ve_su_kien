# Bán vé sự kiện có sơ đồ ghế

## Chạy trên máy cá nhân

Yêu cầu: Docker Desktop và Node.js 18 trở lên.

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec api npm run migrate:latest
```

Kiểm tra ứng dụng tại `http://localhost:8090/` và readiness tại
`http://localhost:8090/health/ready`.

Để chạy trực tiếp bằng Node.js:

```bash
npm ci
npm run migrate:latest
npm start
```

## Kiểm tra trước khi tạo Pull Request

```bash
npm run build
npm run lint
npm test
```

CI chạy build, lint, test và kiểm tra migration trên PostgreSQL thật. Nhóm nên bật
branch protection cho `main`, yêu cầu Pull Request, một người duyệt và các job
`build`, `lint`, `test`, `migration` phải thành công. Lint và test chạy song song.

## Chuẩn bị staging lần đầu

Máy staging cần Docker Engine, Docker Compose và cổng `8090` được mở. Tạo thư mục
`~/ban-ve-su-kien` và file `~/ban-ve-su-kien/.env.staging`:

```dotenv
NODE_ENV=staging
PORT=8090
POSTGRES_USER=postgres
POSTGRES_PASSWORD=replace-with-a-strong-password
POSTGRES_DB=postgres
DB_CONNECTION_STRING=postgres://postgres:replace-with-a-strong-password@db:5432/postgres
```

Không commit file này. Trong GitHub Environment tên `staging`, tạo các secret:

- `STAGING_HOST`: IP hoặc domain máy chủ.
- `STAGING_USER`: tài khoản SSH có quyền chạy Docker.
- `STAGING_SSH_KEY`: private key dành riêng cho CI.
- `STAGING_KNOWN_HOSTS`: kết quả `ssh-keyscan` đã được xác minh.
- `STAGING_URL`: ví dụ `http://staging.example.com:8090`.

Tạo repository variable `STAGING_ENABLED=true` sau khi máy chủ và toàn bộ secret
đã sẵn sàng. Trước thời điểm đó, CI vẫn kiểm tra và build image nhưng bỏ qua deploy.

Khi merge vào `main`, workflow build image lên GitHub Container Registry, chạy
migration, khởi động slot blue/green mới, chờ health check rồi mới chuyển Caddy.
Nếu container mới lỗi, container cũ vẫn phục vụ và workflow thất bại.

## Biến môi trường và bí mật

Chỉ `.env.example` được lưu trong Git. Không đưa `.env`, token, private key hoặc
chuỗi kết nối thật vào commit hay log. Nếu một secret từng được commit, phải đổi
secret đó; thêm vào `.gitignore` không xóa secret khỏi lịch sử Git.
