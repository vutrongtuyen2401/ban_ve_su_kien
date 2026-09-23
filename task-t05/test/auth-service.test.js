const assert = require('node:assert/strict');
const test = require('node:test');
const {
  GENERIC_LOGIN_ERROR,
  LOCKED_LOGIN_ERROR,
  createAuthService,
} = require('../src/auth-service');

function createFixture() {
  const state = {
    failures: new Map(),
    locked: new Set(),
    sessions: [],
  };

  const user = {
    id: 1,
    email: 'demo@example.com',
    passwordHash: 'hashed-password',
    isActive: true,
    role: 'buyer',
  };

  const dependencies = {
    userRepository: {
      async findByEmail(email) {
        return email === user.email ? user : null;
      },
    },
    attemptStore: {
      async getRemainingLockSeconds(key) {
        return state.locked.has(key) ? 900 : 0;
      },
      async recordFailure(key) {
        const count = (state.failures.get(key) || 0) + 1;
        if (count >= 5) {
          state.locked.add(key);
          state.failures.delete(key);
        } else {
          state.failures.set(key, count);
        }
        return count;
      },
      async clear(key) {
        state.failures.delete(key);
        state.locked.delete(key);
      },
    },
    sessionStore: {
      async create(data) {
        state.sessions.push(data);
        return { token: 'session-token', ttlSeconds: 28800 };
      },
    },
    verifyPassword: async (hash, password) =>
      hash === 'hashed-password' && password === 'Demo@1234',
    dummyPasswordHash: 'dummy-hash',
  };

  return { service: createAuthService(dependencies), state };
}

test('đăng nhập đúng tạo phiên và trả về trang chính', async () => {
  const { service, state } = createFixture();
  const result = await service.login({
    email: ' Demo@Example.com ',
    password: 'Demo@1234',
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.redirectTo, '/app.html');
  assert.equal(result.session.token, 'session-token');
  assert.equal(state.sessions.length, 1);
});

test('email không tồn tại và mật khẩu sai trả cùng một thông báo', async () => {
  const first = createFixture();
  const missingUser = await first.service.login({
    email: 'missing@example.com',
    password: 'wrong',
  });

  const second = createFixture();
  const wrongPassword = await second.service.login({
    email: 'demo@example.com',
    password: 'wrong',
  });

  assert.equal(missingUser.status, 401);
  assert.equal(wrongPassword.status, 401);
  assert.equal(missingUser.body.message, GENERIC_LOGIN_ERROR);
  assert.equal(wrongPassword.body.message, GENERIC_LOGIN_ERROR);
});

test('tài khoản không hoạt động bị từ chối bằng thông báo chung', async () => {
  const { state } = createFixture();

  // Tạo fixture riêng để mô phỏng đúng dữ liệu is_active=false từ T-04.
  const inactiveService = createAuthService({
    userRepository: {
      async findByEmail() {
        return {
          id: 2,
          email: 'inactive@example.com',
          passwordHash: 'hashed-password',
          isActive: false,
          role: 'buyer',
        };
      },
    },
    attemptStore: {
      async getRemainingLockSeconds() { return 0; },
      async recordFailure() { return 1; },
      async clear() {},
    },
    sessionStore: {
      async create(data) {
        state.sessions.push(data);
        return { token: 'should-not-exist', ttlSeconds: 28800 };
      },
    },
    verifyPassword: async () => true,
    dummyPasswordHash: 'dummy-hash',
  });

  const result = await inactiveService.login({
    email: 'inactive@example.com',
    password: 'Demo@1234',
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.message, GENERIC_LOGIN_ERROR);
  assert.equal(state.sessions.length, 0);
});

test('sau 5 lần sai, lần thứ 6 bị khóa 15 phút', async () => {
  const { service } = createFixture();

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const result = await service.login({
      email: 'demo@example.com',
      password: 'wrong',
    });
    assert.equal(result.status, 401);
  }

  const sixthAttempt = await service.login({
    email: 'demo@example.com',
    password: 'Demo@1234',
  });

  assert.equal(sixthAttempt.status, 429);
  assert.equal(sixthAttempt.body.message, LOCKED_LOGIN_ERROR);
  assert.equal(sixthAttempt.body.retryAfterSeconds, 900);
});
