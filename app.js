const express = require('express');
const authRouter = require('./routes/auth');

const app = express();
app.use(express.json({ limit: '20kb' }));
app.get('/api/health', (_req, res) => res.json({ success: true, message: 'API is running' }));
app.use('/api/auth', authRouter);
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ success: false, message: 'Dữ liệu JSON không hợp lệ.' });
  console.error('Lỗi không xử lý:', error.message);
  return res.status(500).json({ success: false, message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
});

module.exports = app;
