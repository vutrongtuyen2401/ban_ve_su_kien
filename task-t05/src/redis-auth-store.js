const crypto = require('crypto');

function toPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createRedisAuthStore(redisClient, options = {}) {
  const maxFailedAttempts = toPositiveInteger(options.maxFailedAttempts, 5);
  const lockSeconds = toPositiveInteger(options.lockSeconds, 15 * 60);
  const sessionTtlSeconds = toPositiveInteger(options.sessionTtlSeconds, 8 * 60 * 60);

  const failedKey = (key) => `auth:failed:${key}`;
  const lockKey = (key) => `auth:locked:${key}`;
  const sessionKey = (token) => `auth:session:${token}`;

  const attemptStore = {
    async getRemainingLockSeconds(key) {
      const ttl = await redisClient.ttl(lockKey(key));
      return ttl > 0 ? ttl : 0;
    },

    async recordFailure(key) {
      const redisKey = failedKey(key);
      const failures = await redisClient.incr(redisKey);

      if (failures === 1) {
        await redisClient.expire(redisKey, lockSeconds);
      }

      if (failures >= maxFailedAttempts) {
        await redisClient.set(lockKey(key), '1', { EX: lockSeconds });
        await redisClient.del(redisKey);
      }

      return failures;
    },

    async clear(key) {
      await redisClient.del(failedKey(key), lockKey(key));
    },
  };

  const sessionStore = {
    async create(data) {
      const token = crypto.randomBytes(32).toString('hex');
      await redisClient.set(sessionKey(token), JSON.stringify(data), {
        EX: sessionTtlSeconds,
      });
      return { token, ttlSeconds: sessionTtlSeconds };
    },

    async get(token) {
      if (!token) return null;
      const raw = await redisClient.get(sessionKey(token));
      if (!raw) return null;

      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },

    async remove(token) {
      if (token) await redisClient.del(sessionKey(token));
    },
  };

  return { attemptStore, sessionStore };
}

module.exports = { createRedisAuthStore, toPositiveInteger };
