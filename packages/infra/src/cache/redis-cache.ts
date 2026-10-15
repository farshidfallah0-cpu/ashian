import { Redis } from 'ioredis';
import { BaseCache } from './base-cache.js';
import type { CounterResult } from './types.js';

// INCR + تنظیم انقضا فقط در اولین افزایش، به‌صورت اتمیک
const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { count, redis.call('PTTL', KEYS[1]) }
`;

export class RedisCache extends BaseCache {
  readonly kind = 'redis' as const;
  readonly client: Redis;

  constructor(url: string, keyPrefix = 'ashian:') {
    super();
    this.client = new Redis(url, {
      keyPrefix,
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableAutoPipelining: true,
    });
    this.client.defineCommand('ashianIncrement', { numberOfKeys: 1, lua: INCREMENT_SCRIPT });
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', Math.max(1, Math.round(ttlSeconds)));
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length) await this.client.del(...keys);
  }

  async increment(key: string, windowMs: number): Promise<CounterResult> {
    const client = this.client as Redis & {
      ashianIncrement(key: string, windowMs: number): Promise<[number, number]>;
    };
    const [count, ttlMs] = await client.ashianIncrement(key, windowMs);
    return { count, ttlMs: ttlMs > 0 ? ttlMs : windowMs };
  }

  async ping(): Promise<boolean> {
    try {
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
