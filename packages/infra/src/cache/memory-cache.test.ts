import { describe, expect, it, vi } from 'vitest';
import { MemoryCache } from './memory-cache.js';

function clock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe('MemoryCache', () => {
  it('مقدار را با TTL نگه می‌دارد و بعد از انقضا حذف می‌کند', async () => {
    const t = clock();
    const cache = new MemoryCache(100, t.now);
    await cache.set('a', { n: 1 }, 10);
    expect(await cache.get('a')).toEqual({ n: 1 });
    t.advance(10_001);
    expect(await cache.get('a')).toBeNull();
  });

  it('کپی برمی‌گرداند، نه ارجاع', async () => {
    const cache = new MemoryCache();
    const value = { list: [1] };
    await cache.set('k', value, 60);
    value.list.push(2);
    expect(await cache.get('k')).toEqual({ list: [1] });
  });

  it('با پر شدن ظرفیت، کم‌استفاده‌ترین کلید حذف می‌شود', async () => {
    const cache = new MemoryCache(2);
    await cache.set('a', 1, 60);
    await cache.set('b', 2, 60);
    await cache.get('a'); // a اخیراً استفاده شد
    await cache.set('c', 3, 60);
    expect(await cache.get('b')).toBeNull();
    expect(await cache.get('a')).toBe(1);
    expect(await cache.get('c')).toBe(3);
  });

  it('increment پنجره‌ی ثابت دارد', async () => {
    const t = clock();
    const cache = new MemoryCache(100, t.now);
    expect(await cache.increment('ip', 1000)).toEqual({ count: 1, ttlMs: 1000 });
    t.advance(400);
    expect(await cache.increment('ip', 1000)).toEqual({ count: 2, ttlMs: 600 });
    t.advance(601);
    expect((await cache.increment('ip', 1000)).count).toBe(1);
  });

  it('wrap درخواست‌های هم‌زمان را یکی می‌کند', async () => {
    const cache = new MemoryCache();
    const loader = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 'value';
    });
    const results = await Promise.all(
      Array.from({ length: 20 }, () => cache.wrap('hot', 60, loader)),
    );
    expect(results.every((r) => r === 'value')).toBe(true);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(await cache.wrap('hot', 60, loader)).toBe('value');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('خطای loader کش نمی‌شود', async () => {
    const cache = new MemoryCache();
    await expect(
      cache.wrap('x', 60, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await cache.wrap('x', 60, async () => 'ok')).toBe('ok');
  });
});
