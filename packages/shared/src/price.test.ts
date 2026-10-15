import { describe, expect, it } from 'vitest';
import { formatCheques, formatPrice, formatRent } from './price.js';

describe('formatPrice', () => {
  it.each([
    [950, '۹۵۰ درهم'],
    [85_000, '۸۵ هزار درهم'],
    [85_500, '۸۵٫۵ هزار درهم'],
    [120_000, '۱۲۰ هزار درهم'],
    [1_000_000, '۱ میلیون درهم'],
    [1_250_000, '۱٫۲۵ میلیون درهم'],
    [12_400_000, '۱۲٫۴ میلیون درهم'],
    [2_100_000_000, '۲٫۱ میلیارد درهم'],
  ])('%d → %s', (amount, expected) => {
    expect(formatPrice(amount)).toBe(expected);
  });

  it('حالت کامل با جداکننده', () => {
    expect(formatPrice(1_250_000, { compact: false })).toBe('۱٬۲۵۰٬۰۰۰ درهم');
  });

  it('بدون برچسب ارز', () => {
    expect(formatPrice(120_000, { withCurrency: false })).toBe('۱۲۰ هزار');
  });
});

describe('formatRent', () => {
  it('دوره‌ی پیش‌فرض سالانه است', () => {
    expect(formatRent(140_000)).toBe('۱۴۰ هزار درهم / سال');
  });

  it('دوره‌ی ماهانه', () => {
    expect(formatRent(9_500, 'monthly')).toBe('۹٫۵ هزار درهم / ماه');
  });
});

describe('formatCheques', () => {
  it('یک چک یعنی یک‌جا', () => {
    expect(formatCheques(1)).toBe('یک‌جا');
    expect(formatCheques(4)).toBe('۴ چک');
  });
});
