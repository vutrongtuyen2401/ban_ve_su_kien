const crypto = require('crypto');

const GENERIC_LOGIN_ERROR = 'Email hoặc mật khẩu không đúng.';
const LOCKED_LOGIN_ERROR = 'Đăng nhập tạm thời bị khóa. Vui lòng thử lại sau.';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function emailKey(email) {
  return crypto.createHash('sha256').update(email).digest('hex');
}

function createAuthService({
  userRepository,
  attemptStore,
  sessionStore,
  verifyPassword,
  dummyPasswordHash,
}) {
  if (!userRepository || !attemptStore || !sessionStore || !verifyPassword || !dummyPasswordHash) {
    throw new Error('Thiếu dependency để khởi tạo auth service.');
  }

  async function login(input = {}) {
    const email = normalizeEmail(input.email);
    const password = typeof input.password === 'string' ? input.password : '';

    if (!email || !password) {
      return {
        status: 400,
        body: { success: false, message: 'Vui lòng nhập email và mật khẩu.' },
      };
    }

    const key = emailKey(email);
    const lockSeconds = await attemptStore.getRemainingLockSeconds(key);

    if (lockSeconds > 0) {
      return {
        status: 429,
        body: {
          success: false,
          message: LOCKED_LOGIN_ERROR,
          retryAfterSeconds: lockSeconds,
        },
      };
    }

    const user = await userRepository.findByEmail(email);
    const passwordHash = user?.passwordHash || dummyPasswordHash;
    let passwordMatches = false;

    try {
      passwordMatches = await verifyPassword(passwordHash, password);
    } catch {
      passwordMatches = false;
    }

    if (!user || !passwordMatches || user.isActive === false) {
      await attemptStore.recordFailure(key);
      return {
        status: 401,
        body: { success: false, message: GENERIC_LOGIN_ERROR },
      };
    }

    await attemptStore.clear(key);

    const session = await sessionStore.create({
      userId: user.id,
      email: user.email,
      role: user.role || null,
    });

    return {
      status: 200,
      session,
      body: {
        success: true,
        message: 'Đăng nhập thành công.',
        redirectTo: '/app.html',
        user: {
          id: user.id,
          email: user.email,
          role: user.role || null,
        },
      },
    };
  }

  return { login };
}

module.exports = {
  GENERIC_LOGIN_ERROR,
  LOCKED_LOGIN_ERROR,
  createAuthService,
  emailKey,
  normalizeEmail,
};
