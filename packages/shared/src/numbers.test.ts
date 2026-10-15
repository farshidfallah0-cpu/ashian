import { describe, expect, it } from 'vitest';
import { formatNumber, parseNumber, toEnglishDigits, toPersianDigits } from './numbers.js';

describe('toEnglishDigits', () => {
  it('ارقام فارسی و عربی را تبدیل می‌کند', () => {
    expect(toEnglishDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
    expect(toEnglishDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
  });

  it('بقیه‌ی متن را دست نمی‌زند', () => {
    expect(toEnglishDigits('واحد ۱۲ - طبقه 3')).toBe('واحد 12 - طبقه 3');
  });
});

describe('toPersianDigits', () => {
  it('عدد و رشته را به ارقام فارسی می‌برد', () => {
    expect(toPersianDigits(2026)).toBe('۲۰۲۶');
    expect(toPersianDigits('A-12 / ٣')).toBe('A-۱۲ / ۳');
  });
});

describe('parseNumber', () => {
  it.each([
    ['۱۲۰٬۰۰۰', 120000],
    ['120,000', 120000],
    ['١٢٠،٠٠٠', 120000],
    [' 85 500 ', 85500],
    ['۱٫۵', 1.5],
    ['2.75', 2.75],
    ['-۴', -4],
  ])('«%s» → %d', (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });

  it.each(['', 'abc', '12a', '1.2.3', '--1'])('«%s» نامعتبر است', (input) => {
    expect(parseNumber(input)).toBeNull();
  });
});

describe('formatNumber', () => {
  it('جداکننده‌ی هزارگان فارسی دارد', () => {
    expect(formatNumber(1234567)).toBe('۱٬۲۳۴٬۵۶۷');
  });

  it('ممیز فارسی دارد', () => {
    expect(formatNumber(1.25)).toBe('۱٫۲۵');
  });
});
