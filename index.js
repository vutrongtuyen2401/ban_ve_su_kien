require('dotenv').config();

const db = require('./db');
const { createApp } = require('./app');

const port = Number(process.env.PORT || 8090);
const server = createApp(db).listen(port, () => {
  console.log(`Server API đang chạy tại cổng ${port}`);
});

async function shutdown(signal) {
  console.log(`Nhận ${signal}, đang dừng server...`);
  server.close(async () => {
    await db.destroy();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
