import { describe, expect, it } from 'vitest';
import { getPageRange } from './pagination-range';

describe('getPageRange', () => {
  it('صفحه‌ی کم: همه نمایش داده می‌شود', () => {
    expect(getPageRange(1, 1)).toEqual([1]);
    expect(getPageRange(3, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(getPageRange(1, 0)).toEqual([]);
  });

  it('ابتدا: gap فقط سمت آخر', () => {
    expect(getPageRange(1, 20)).toEqual([1, 2, 'gap', 20]);
    expect(getPageRange(3, 20)).toEqual([1, 2, 3, 4, 'gap', 20]);
  });

  it('وسط: دو gap', () => {
    expect(getPageRange(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
  });

  it('انتها: gap فقط سمت اول', () => {
    expect(getPageRange(20, 20)).toEqual([1, 'gap', 19, 20]);
  });

  it('جای یک صفحه را با gap پر نمی‌کند', () => {
    expect(getPageRange(4, 20)).toEqual([1, 2, 3, 4, 5, 'gap', 20]);
    expect(getPageRange(17, 20)).toEqual([1, 'gap', 16, 17, 18, 19, 20]);
  });

  it('صفحه‌ی خارج از بازه را کنار می‌زند', () => {
    expect(getPageRange(99, 10)).toEqual(getPageRange(10, 10));
    expect(getPageRange(-5, 10)).toEqual(getPageRange(1, 10));
  });
});
