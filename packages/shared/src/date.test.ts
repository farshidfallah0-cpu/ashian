import { describe, expect, it } from 'vitest';
import { formatDate, formatRelative } from './date.js';

// ۶ اکتبر ۲۰۲۶، ظهر به وقت دبی = ۱۴ مهر ۱۴۰۵
const NOW = new Date('2026-10-06T08:00:00Z');

describe('formatDate', () => {
  it('شمسی بلند', () => {
    expect(formatDate(NOW)).toBe('۱۴ مهر ۱۴۰۵');
  });

  it('شمسی کوتاه', () => {
    expect(formatDate(NOW, 'short')).toBe('۱۴ مهر');
  });

  it('شمسی عددی', () => {
    expect(formatDate(NOW, 'numeric')).toBe('۱۴۰۵/۰۷/۱۴');
  });

  it('میلادی با ارقام فارسی', () => {
    expect(formatDate(NOW, 'long', 'gregory')).toBe('۶ اکتبر ۲۰۲۶');
  });

  it('رشته‌ی ISO را می‌پذیرد', () => {
    expect(formatDate('2026-03-21T12:00:00Z')).toBe('۱ فروردین ۱۴۰۵');
  });
});

describe('formatRelative', () => {
  const ago = (ms: number) => new Date(NOW.getTime() - ms);
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it.each([
    [10_000, 'همین حالا'],
    [5 * MIN, '۵ دقیقه پیش'],
    [3 * HOUR, '۳ ساعت پیش'],
    [DAY + HOUR, 'دیروز'],
    [3 * DAY, '۳ روز پیش'],
    [15 * DAY, '۲ هفته پیش'],
    [40 * DAY, 'یک ماه پیش'],
  ])('%d میلی‌ثانیه → %s', (ms, expected) => {
    expect(formatRelative(ago(ms), NOW)).toBe(expected);
  });

  it('بیشتر از ۶۰ روز → تاریخ کامل', () => {
    // ۹۰ روز قبل = ۸ ژوئیه = ۱۷ تیر
    expect(formatRelative(ago(90 * DAY), NOW)).toBe('۱۷ تیر ۱۴۰۵');
  });
});
