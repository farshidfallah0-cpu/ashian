import { BaseCache } from './base-cache.js';
import type { CounterResult } from './types.js';

interface Entry {
  value: string;
  expiresAt: number;
}

/**
 * کش داخل حافظه برای حالت lite. محدود به maxEntries با سیاست LRU.
 * مقدارها JSON ذخیره می‌شوند تا رفتارش دقیقاً مثل Redis باشد (بدون اشتراک ارجاع).
 */
export class MemoryCache extends BaseCache {
  readonly kind = 'memory' as const;
  private readonly store = new Map<string, Entry>();

  constructor(
    private readonly maxEntries = 10_000,
    private readonly now: () => number = Date.now,
  ) {
    super();
  }

  private read(key: string): Entry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    // جابه‌جایی به انتهای Map = اخیراً استفاده‌شده
    this.store.delete(key);
    this.store.set(key, entry);
    return entry;
  }

  private write(key: string, entry: Entry) {
    this.store.delete(key);
    this.store.set(key, entry);
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.read(key);
    return entry ? (JSON.parse(entry.value) as T) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.write(key, { value: JSON.stringify(value), expiresAt: this.now() + ttlSeconds * 1000 });
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) this.store.delete(key);
  }

  async increment(key: string, windowMs: number): Promise<CounterResult> {
    const now = this.now();
    const entry = this.read(key);
    const count = entry ? Number(entry.value) + 1 : 1;
    const expiresAt = entry ? entry.expiresAt : now + windowMs;
    this.write(key, { value: String(count), expiresAt });
    return { count, ttlMs: expiresAt - now };
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    this.store.clear();
  }
}
