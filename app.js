const express = require('express');

function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/', (_req, res) => res.status(200).json({ name: 'ban-ve-su-kien', status: 'ok' }));
  app.get('/health/live', (_req, res) => res.status(200).json({ status: 'ok' }));
  app.get('/health/ready', async (_req, res) => {
    try {
      await db.raw('SELECT 1');
      res.status(200).json({ status: 'ready' });
    } catch (_error) {
      res.status(503).json({ status: 'not_ready' });
    }
  });

  app.get('/api/events', async (_req, res) => {
    try {
      const events = await db('events').select('*');
      res.status(200).json({ success: true, data: events });
    } catch (_error) {
      res.status(500).json({ success: false, message: 'Không thể tải danh sách sự kiện' });
    }
  });

  app.post('/api/events', async (req, res) => {
    try {
      const { title, description, price, total_tickets: totalTickets } = req.body;
      const [newEvent] = await db('events')
        .insert({ title, description, price, total_tickets: totalTickets })
        .returning('*');
      res.status(201).json({ success: true, data: newEvent });
    } catch (_error) {
      res.status(500).json({ success: false, message: 'Không thể tạo sự kiện' });
    }
  });

  return app;
}

module.exports = { createApp };

