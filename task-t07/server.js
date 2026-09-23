const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const users = [
  {
    id: 1,
    fullName: 'Demo User',
    email: 'demo@example.com',
    passwordHash: crypto.createHash('sha256').update('Demo@1234').digest('hex'),
    role: 'buyer',
    isActive: false,
    emailVerified: false,
    createdAt: new Date().toISOString(),
  },
];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function createErrorResponse(res, statusCode, message) {
  return res.status(statusCode).json({
    success: false,
    message,
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, fullName } = req.body || {};

    if (!email || !password || !fullName) {
      return createErrorResponse(res, 400, 'Vui lòng điền đầy đủ thông tin: email, mật khẩu và họ tên.');
    }

    const normalizedEmail = normalizeEmail(email);
    const trimmedFullName = String(fullName).trim();

    if (!trimmedFullName || trimmedFullName.length < 2) {
      return createErrorResponse(res, 400, 'Họ tên phải có ít nhất 2 ký tự.');
    }

    if (!isValidEmail(normalizedEmail)) {
      return createErrorResponse(res, 400, 'Email không hợp lệ.');
    }

    if (typeof password !== 'string' || password.trim().length < 8) {
      return createErrorResponse(res, 400, 'Mật khẩu phải có ít nhất 8 ký tự.');
    }

    const emailExists = users.some((user) => normalizeEmail(user.email) === normalizedEmail);
    if (emailExists) {
      return createErrorResponse(res, 409, 'Đăng ký không thành công. Vui lòng kiểm tra thông tin và thử lại.');
    }

    const newUser = {
      id: users.length + 1,
      fullName: trimmedFullName,
      email: normalizedEmail,
      passwordHash: crypto.createHash('sha256').update(password).digest('hex'),
      role: 'buyer',
      isActive: false,
      emailVerified: false,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    return res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công.',
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
        emailVerified: newUser.emailVerified,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    return createErrorResponse(res, 500, 'Lỗi hệ thống. Vui lòng thử lại sau.');
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

module.exports = { app, users };
