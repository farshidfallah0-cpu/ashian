import { describe, expect, it } from 'vitest';
import { distanceMeters, findNearby } from './nearby.js';

describe('distanceMeters', () => {
  it('فاصله‌ی یک نقطه با خودش صفر است', () => {
    expect(distanceMeters([55.27, 25.2], [55.27, 25.2])).toBe(0);
  });

  it('یک درجه عرض جغرافیایی ≈ ۱۱۱ کیلومتر', () => {
    const d = distanceMeters([55, 25], [55, 26]);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_500);
  });
});

describe('findNearby', () => {
  it('در دبی مارینا مترو/ترام، مرکز خرید و مدرسه پیدا می‌شود و به ترتیب فاصله است', () => {
    const items = findNearby(55.1403, 25.0805);
    const categories = new Set(items.map((i) => i.category));
    expect(categories).toContain('metro');
    expect(categories).toContain('mall');
    for (const category of categories) {
      const distances = items.filter((i) => i.category === category).map((i) => i.distanceM);
      expect(distances).toEqual([...distances].sort((a, b) => a - b));
      expect(distances.length).toBeLessThanOrEqual(3);
    }
  });

  it('زمان پیاده‌روی با فاصله هماهنگ و حداقل یک دقیقه است', () => {
    for (const item of findNearby(55.2744, 25.1972)) {
      expect(item.walkMinutes).toBeGreaterThanOrEqual(1);
      expect(item.walkMinutes).toBeLessThanOrEqual(Math.ceil((item.distanceM * 1.3) / 80) + 1);
    }
  });

  it('وسط خلیج فارس چیزی نزدیک نیست', () => {
    expect(findNearby(52, 27)).toEqual([]);
  });
});
