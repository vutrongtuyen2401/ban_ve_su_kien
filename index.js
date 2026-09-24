require('dotenv').config();
const app = require('./app');
const db = require('./db');
const { assertEmailConfiguration } = require('./services/emailService');
const { cleanupExpiredHolds } = require('./services/seatHoldService');

const port = Number(process.env.PORT || 8090);

async function start() {
  try {
    assertEmailConfiguration();
    await db.raw('SELECT 1');
    await cleanupExpiredHolds();
    const cleanupTimer = setInterval(() => cleanupExpiredHolds().catch((error) => console.error('Lỗi dọn ghế hết hạn:', error.message)), 60_000);
    cleanupTimer.unref();
    app.listen(port, () => console.log(`Server API đang chạy tại http://localhost:${port}`));
  } catch (error) {
    console.error('Không thể khởi động server:', error.message);
    await db.destroy();
    process.exit(1);
  }
}

start();
