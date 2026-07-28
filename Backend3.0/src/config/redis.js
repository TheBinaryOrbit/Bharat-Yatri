import Redis from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

export const connectRedis = async () => {
  await redis.connect();
  console.log(`✅ Redis connected: ${redis.options.host}:${redis.options.port}`);

  redis.on('error', (err) => {
    console.error(`Redis connection error: ${err.message}`);
  });

  redis.on('end', () => {
    console.warn('⚠️  Redis disconnected');
  });

  return redis;
};
