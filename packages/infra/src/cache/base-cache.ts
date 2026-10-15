import type { Cache, CounterResult } from './types.js';

/** پیاده‌سازی مشترک wrap با حذف درخواست‌های تکراری هم‌زمان */
export abstract class BaseCache implements Cache {
  abstract readonly kind: Cache['kind'];
  private readonly inflight = new Map<string, Promise<unknown>>();

  abstract get<T>(key: string): Promise<T | null>;
  abstract set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  abstract del(...keys: string[]): Promise<void>;
  abstract increment(key: string, windowMs: number): Promise<CounterResult>;
  abstract ping(): Promise<boolean>;
  abstract close(): Promise<void>;

  async wrap<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = (async () => {
      try {
        const value = await loader();
        if (value !== null && value !== undefined) await this.set(key, value, ttlSeconds);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, promise);
    return promise;
  }
}
