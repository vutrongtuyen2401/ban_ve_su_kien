require('dotenv').config();
const app = require('./app');
const db = require('./db');
const { assertEmailConfiguration } = require('./services/emailService');

const port = Number(process.env.PORT || 8090);

async function startServer() {
  try {
    assertEmailConfiguration();
    await db.raw('SELECT 1');

    app.listen(port, () => {
      console.log(`Server đang chạy tại http://localhost:${port}`);
      console.log('Đã kết nối PostgreSQL thành công.');

      if (process.env.NODE_ENV === 'development') {
        console.log('Email development sẽ được in tại terminal, không gửi qua SMTP.');
      }
    });
  } catch (error) {
    console.error('Không thể khởi động server:', error.message);
    await db.destroy();
    process.exit(1);
  }
}

startServer();
