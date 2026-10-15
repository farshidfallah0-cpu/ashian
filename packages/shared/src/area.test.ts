import { describe, expect, it } from 'vitest';
import { convertArea, formatArea, sqftToSqm, sqmToSqft } from './area.js';

describe('area', () => {
  it('تبدیل رفت و برگشت دقیق است', () => {
    expect(sqmToSqft(sqftToSqm(1200))).toBeCloseTo(1200, 6);
  });

  it('۱۰۰ متر مربع ≈ ۱۰۷۶ فوت مربع', () => {
    expect(Math.round(sqmToSqft(100))).toBe(1076);
    expect(convertArea(100, 'sqft', 'sqm')).toBeCloseTo(1076.39, 1);
  });

  it('نمایش با واحد پیش‌فرض بازار (فوت مربع)', () => {
    expect(formatArea(1250)).toBe('۱٬۲۵۰ فوت مربع');
  });

  it('نمایش به متر مربع', () => {
    expect(formatArea(1076, 'sqm')).toBe('۱۰۰ متر مربع');
  });
});
