import { describe, expect, it } from 'vitest';
import { decodeGeohash, encodeGeohash, precisionForZoom } from './geohash.js';

describe('geohash', () => {
  it('نمونه‌ی شناخته‌شده‌ی ویکی‌پدیا', () => {
    expect(encodeGeohash(57.64911, 10.40744, 11)).toBe('u4pruydqqvj');
  });

  it('دبی در سلول «thrr…» می‌افتد', () => {
    expect(encodeGeohash(25.2048, 55.2708, 3)).toBe('thr');
  });

  it('رمزگشایی نزدیک مختصات اصلی است', () => {
    const hash = encodeGeohash(25.0805, 55.1403, 7);
    const { lat, lng } = decodeGeohash(hash);
    expect(Math.abs(lat - 25.0805)).toBeLessThan(0.002);
    expect(Math.abs(lng - 55.1403)).toBeLessThan(0.002);
  });

  it('پیشوند: دقت کمتر پیشوند دقت بیشتر است', () => {
    const fine = encodeGeohash(25.0805, 55.1403, 6);
    expect(fine.startsWith(encodeGeohash(25.0805, 55.1403, 4))).toBe(true);
  });

  it('کاراکتر نامعتبر خطا می‌دهد', () => {
    expect(() => decodeGeohash('abca!')).toThrow();
  });

  it('دقت بر اساس زوم', () => {
    expect([5, 8, 10, 12, 14].map(precisionForZoom)).toEqual([3, 4, 5, 6, 6]);
  });
});
