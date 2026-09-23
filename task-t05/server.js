require('dotenv').config();

const path = require('path');
const argon2 = require('argon2');
const express = require('express');
const knex = require('knex');
const { createClient } = require('redis');
const { createAuthService } = require('./src/auth-service');
const { parseCookies } = require('./src/cookies');
const { createRedisAuthStore, toPositiveInteger } = require('./src/redis-auth-store');
const { createUserRepository } = require('./src/user-repository');

// Hash Argon2id hợp lệ dùng để cân bằng thời gian xử lý khi email không tồn tại.
// Đây không phải mật khẩu của người dùng và không được dùng để đăng nhập.
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQxMjM0NTY3OA$Nc3l+3aGX6Rho/eZpArXnZtKZQ/0F1W5EcI+oFQf6vA';

const port = toPositiveInteger(process.env.PORT, 8091);
const cookieName = process.env.SESSION_COOKIE_NAME || 't05_session';
const db = knex({
  client: 'pg',
  connection: process.env.DB_CONNECTION_STRING,
});
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

redisClient.on('error', (error) => {
  console.error('Redis error:', error.message);
});

const { attemptStore, sessionStore } = createRedisAuthStore(redisClient, {
  maxFailedAttempts: process.env.LOGIN_MAX_FAILED_ATTEMPTS,
  lockSeconds: process.env.LOGIN_LOCK_SECONDS,
  sessionTtlSeconds: process.env.SESSION_TTL_SECONDS,
});

const authService = createAuthService({
  userRepository: createUserRepository(db),
  attemptStore,
  sessionStore,
  verifyPassword: (hash, password) => argon2.verify(hash, password),
  dummyPasswordHash: DUMMY_PASSWORD_HASH,
});

const app = express();
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (_req, res) => {
  res.redirect('/login.html');
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const result = await authService.login(req.body);

    if (result.session) {
      res.cookie(cookieName, result.session.token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: result.session.ttlSeconds * 1000,
        path: '/',
      });
    }

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Hệ thống đang bận. Vui lòng thử lại sau.',
    });
  }
});

app.get('/api/auth/session', async (req, res) => {
  const token = parseCookies(req.headers.cookie)[cookieName];
  const session = await sessionStore.get(token);

  if (!session) {
    return res.status(401).json({ success: false, message: 'Phiên đăng nhập không hợp lệ.' });
  }

  return res.json({ success: true, user: session });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = parseCookies(req.headers.cookie)[cookieName];
  await sessionStore.remove(token);
  res.clearCookie(cookieName, { path: '/' });
  return res.json({ success: true, message: 'Đã đăng xuất.' });
});

async function start() {
  await redisClient.connect();
  await db.raw('SELECT 1');

  app.listen(port, () => {
    console.log(`T-05 login chạy tại http://localhost:${port}`);
  });
}

if (require.main === module) {
  start().catch(async (error) => {
    console.error('Không thể khởi động T-05:', error.message);
    if (redisClient.isOpen) await redisClient.quit();
    await db.destroy();
    process.exitCode = 1;
  });
}

module.exports = { app, start };
