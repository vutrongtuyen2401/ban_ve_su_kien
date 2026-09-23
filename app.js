const path = require('path');
const express = require('express');
const db = require('./db');
const authRouter = require('./routes/auth');

const app = express();

app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

app.use('/api/auth', authRouter);

app.get('/api/events', async (req, res) => {
  try {
    const events = await db('events').select('*');
    res.status(200).json({ success: true, data: events });
  } catch (error) {
    console.error('Lỗi lấy sự kiện:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
});

app.post('/api/events', async (req, res) => {
  try {
    const { title, description, price, total_tickets } = req.body;
    const [newEvent] = await db('events')
      .insert({ title, description, price, total_tickets })
      .returning('*');
    res.status(201).json({ success: true, data: newEvent });
  } catch (error) {
    console.error('Lỗi tạo sự kiện:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ success: false, message: 'Dữ liệu JSON không hợp lệ.' });
  }

  console.error('Lỗi không xử lý:', error.message);
  return res.status(500).json({ success: false, message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
});

module.exports = app;
