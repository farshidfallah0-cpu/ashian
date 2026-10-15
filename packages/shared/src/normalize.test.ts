import { describe, expect, it } from 'vitest';
import { normalizeForSearch, normalizePersian } from './normalize.js';

describe('normalizePersian', () => {
  it('ي و ك عربی را فارسی می‌کند', () => {
    expect(normalizePersian('كيش')).toBe('کیش');
    expect(normalizePersian('مرسى')).toBe('مرسی');
  });

  it('ئ فارسی را حفظ می‌کند', () => {
    expect(normalizePersian('مسئله')).toBe('مسئله');
  });

  it('ارقام را به فرم ذخیره‌سازی (انگلیسی) می‌برد', () => {
    expect(normalizePersian('واحد ۱۲ طبقه ٣')).toBe('واحد 12 طبقه 3');
  });

  it('اعراب و کشیده را حذف می‌کند', () => {
    expect(normalizePersian('مَسْكَن')).toBe('مسکن');
    expect(normalizePersian('بـــرج')).toBe('برج');
  });

  it('نیم‌فاصله را حفظ می‌کند', () => {
    expect(normalizePersian('آپارتمان‌ها')).toBe('آپارتمان‌ها');
  });

  it('نیم‌فاصله‌ی تکراری یا کنار فاصله را اصلاح می‌کند', () => {
    expect(normalizePersian('خانه‌‌ها')).toBe('خانه‌ها');
    expect(normalizePersian('خانه ‌ ها')).toBe('خانه ها');
  });

  it('کاراکترهای نامرئی دیگر را حذف می‌کند', () => {
    expect(normalizePersian('﻿دبی​ مارینا')).toBe('دبی مارینا');
  });

  it('فاصله‌ها را یکسان و trim می‌کند ولی خط جدید را نگه می‌دارد', () => {
    expect(normalizePersian('  برج   خلیفه \n  داون‌تاون  ')).toBe('برج خلیفه\nداون‌تاون');
  });
});

describe('normalizeForSearch', () => {
  it('شکل‌های مختلف یک کلمه را یکی می‌کند', () => {
    const a = normalizeForSearch('آپارتمان‌ها');
    const b = normalizeForSearch('اپارتمان ها');
    const c = normalizeForSearch('آپارتمان ‌ها');
    expect(a).toBe('اپارتمان ها');
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('لاتین را کوچک و نشانه‌ها را حذف می‌کند', () => {
    expect(normalizeForSearch('JLT, Cluster-D!')).toBe('jlt cluster-d');
  });

  it('کد آگهی با ارقام فارسی را پیدا می‌کند', () => {
    expect(normalizeForSearch('کد ۴۸۲۱۹')).toBe('کد 48219');
  });
});
