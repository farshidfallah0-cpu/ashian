import type { Cache } from '@ashian/infra';
import type { ThrottlerStorage } from '@nestjs/throttler';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * ذخیره‌ی شمارنده‌های rate limit در آداپتور کش (Redis در production)،
 * تا محدودیت بین همه‌ی نسخه‌های API مشترک باشد و API بدون وضعیت بماند.
 * ttl و blockDuration به میلی‌ثانیه؛ خروجی‌های زمانی به ثانیه (قرارداد throttler).
 */
export class CacheThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly cache: Cache) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const counterKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `${counterKey}:blocked`;
    const extendedBlock = blockDuration > ttl;
    const now = Date.now();

    if (extendedBlock) {
      const blockedUntil = await this.cache.get<number>(blockKey);
      if (blockedUntil && blockedUntil > now) {
        const seconds = Math.ceil((blockedUntil - now) / 1000);
        return {
          totalHits: limit + 1,
          timeToExpire: seconds,
          isBlocked: true,
          timeToBlockExpire: seconds,
        };
      }
    }

    const { count, ttlMs } = await this.cache.increment(counterKey, ttl);
    const timeToExpire = Math.ceil(ttlMs / 1000);

    if (count <= limit) {
      return { totalHits: count, timeToExpire, isBlocked: false, timeToBlockExpire: 0 };
    }

    if (extendedBlock) {
      await this.cache.set(blockKey, now + blockDuration, blockDuration / 1000);
      return {
        totalHits: count,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockDuration / 1000),
      };
    }
    // مدت مسدودی = باقی‌مانده‌ی همین پنجره
    return { totalHits: count, timeToExpire, isBlocked: true, timeToBlockExpire: timeToExpire };
  }
}
