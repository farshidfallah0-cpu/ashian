import { describe, expect, it } from 'vitest';
import { SAME_PHOTO_DISTANCE, hammingHex } from './phash.js';

describe('hammingHex', () => {
  it('هش یکسان = ۰', () => {
    expect(hammingHex('ffff0000ffff0000', 'ffff0000ffff0000')).toBe(0);
  });
  it('فاصله‌ی بیت‌ها را می‌شمارد', () => {
    expect(hammingHex('0000000000000000', '000000000000000f')).toBe(4);
    expect(hammingHex('0000000000000000', 'ffffffffffffffff')).toBe(64);
  });
  it('هش ناقص یا نامعتبر هیچ‌وقت شبیه نیست', () => {
    expect(hammingHex(null, 'ffff')).toBe(Number.POSITIVE_INFINITY);
    expect(hammingHex('abcd', 'abc')).toBe(Number.POSITIVE_INFINITY);
    expect(hammingHex('zzzz', 'abcd')).toBe(Number.POSITIVE_INFINITY);
    expect(SAME_PHOTO_DISTANCE).toBeGreaterThan(0);
  });
});
