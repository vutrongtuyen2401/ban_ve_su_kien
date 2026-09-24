const path = require('path');
const express = require('express');
const authRouter = require('./routes/auth');
const eventsRouter = require('./routes/events');

const app = express();

app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ success: false, message: 'Dữ liệu JSON không hợp lệ.' });
  }

  console.error('Lỗi không xử lý:', error.message);
  return res.status(500).json({ success: false, message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
});

module.exports = app;
