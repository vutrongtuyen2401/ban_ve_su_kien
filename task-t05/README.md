# Task T-05: Đăng nhập bằng email và mật khẩu

Mô-đun này được tạo riêng cho T-05 và không sửa các tệp hiện có của nhóm.

## Yêu cầu đã triển khai

- Form đăng nhập bằng email và mật khẩu.
- Mật khẩu được đối chiếu với hash Argon2id từ PostgreSQL.
- Phiên đăng nhập được lưu trong Redis và gửi về trình duyệt bằng cookie `HttpOnly`.
- Số lần đăng nhập sai được lưu trong Redis, không lưu trong bộ nhớ tiến trình.
- Sau 5 lần sai, lần thứ 6 bị khóa trong 15 phút.
- Việc khởi động lại ứng dụng không xóa trạng thái khóa vì dữ liệu nằm trong Redis.
- Email không tồn tại và mật khẩu sai nhận cùng một thông báo.
- Có trang chính tối thiểu để kiểm tra phiên và thao tác đăng xuất.

## Phụ thuộc vào T-04

T-05 không tạo hoặc sửa migration của T-04. Mô-đun chờ T-04 cung cấp các bảng và cột sau:

```text
users(id, email, password_hash)
roles(id, name)
user_roles(user_id, role_id)
```

Nếu T-04 chọn tên cột khác, nhóm cần thống nhất giao diện dữ liệu trước khi tích hợp. Không nên âm thầm sửa migration của người làm T-04.

## Chạy thử

1. Tạo `task-t05/.env` từ `task-t05/.env.example`.
2. Khởi động PostgreSQL và Redis hiện có của dự án:

   ```bash
   docker compose up -d db redis
   ```

3. Cài dependency và chạy kiểm thử:

   ```bash
   cd task-t05
   npm install
   npm test
   npm start
   ```

4. Mở `http://localhost:8091/login.html`.

Không commit thư mục `node_modules`; `.gitignore` ở thư mục gốc đã loại trừ thư mục này.
