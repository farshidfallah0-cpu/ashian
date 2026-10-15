import type { SearchCard } from '@ashian/shared';
import { describe, expect, it } from 'vitest';
import { alertText, isDue, newerThan } from './alerts.js';

const NOW = Date.UTC(2026, 9, 15, 12, 0, 0);
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000);

describe('isDue', () => {
  it('بدون هشدار هیچ‌وقت', () => {
    expect(isDue('none', null, NOW)).toBe(false);
  });
  it('فوری همیشه، اولین بار هم', () => {
    expect(isDue('instant', hoursAgo(0), NOW)).toBe(true);
    expect(isDue('instant', null, NOW)).toBe(true);
  });
  it('روزانه: بعد از ۲۳ ساعت از آخرین اعلان', () => {
    expect(isDue('daily', hoursAgo(5), NOW)).toBe(false);
    expect(isDue('daily', hoursAgo(23.5), NOW)).toBe(true);
  });
  it('هفتگی: حدود هفت روز', () => {
    expect(isDue('weekly', hoursAgo(24 * 3), NOW)).toBe(false);
    expect(isDue('weekly', hoursAgo(24 * 7), NOW)).toBe(true);
  });
});

describe('newerThan', () => {
  const card = (id: string, publishedAt: string | null) => ({ publicId: id, publishedAt }) as SearchCard;
  it('فقط آگهی‌های بعد از زمان مرجع', () => {
    const items = [
      card('a', hoursAgo(1).toISOString()),
      card('b', hoursAgo(30).toISOString()),
      card('c', null),
    ];
    expect(newerThan(items, hoursAgo(10)).map((i) => i.publicId)).toEqual(['a']);
  });
});

describe('alertText', () => {
  it('نام جستجو، تعداد و لینک دارد', () => {
    const text = alertText('اجاره مارینا', 3, 'https://x.test/search?a=1');
    expect(text).toContain('«اجاره مارینا»');
    expect(text).toContain('https://x.test/search?a=1');
    expect(text).toContain('۳');
  });
  it('وقتی همه‌ی صفحه تازه است «بیش از» می‌نویسد', () => {
    expect(alertText('x', 20, 'l')).toContain('بیش از');
  });
});
