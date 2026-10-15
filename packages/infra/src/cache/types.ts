export interface CounterResult {
  count: number;
  /** زمان باقی‌مانده تا ریست شمارنده */
  ttlMs: number;
}

export interface Cache {
  readonly kind: 'memory' | 'redis';
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  /** شمارنده‌ی پنجره‌ی ثابت؛ برای rate limiting */
  increment(key: string, windowMs: number): Promise<CounterResult>;
  /**
   * اگر کلید در کش بود همان را برمی‌گرداند؛ وگرنه loader را صدا می‌زند و نتیجه را ذخیره می‌کند.
   * درخواست‌های هم‌زمان برای یک کلید فقط یک بار loader را اجرا می‌کنند (جلوگیری از stampede).
   */
  wrap<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}
