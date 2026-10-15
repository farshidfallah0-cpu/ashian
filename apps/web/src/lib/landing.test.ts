import { describe, expect, it } from 'vitest';
import { landingPath, landingPreset, parseLanding, type LandingPlace } from './landing';
import { countActiveFilters, filtersOnly, withPatch } from './search-url';

const places: LandingPlace[] = [
  { type: 'emirate', slug: 'dubai', path: 'dubai' },
  { type: 'community', slug: 'dubai-marina', path: 'dubai/dubai-marina' },
  { type: 'tower', slug: 'marina-gate-1', path: 'dubai/dubai-marina/marina-gate-1' },
  { type: 'community', slug: 'business-bay', path: 'dubai/business-bay' },
];

describe('parseLanding', () => {
  it('مسیر کامل را به مشخصات تبدیل می‌کند', () => {
    expect(parseLanding('rent', ['apartment', '2-bedroom', 'dubai-marina'], places)).toEqual({
      deal: 'rent',
      propertyType: 'apartment',
      bedrooms: 2,
      location: 'dubai/dubai-marina',
    });
  });

  it('مسیرهای کوتاه و استودیو و برج', () => {
    expect(parseLanding('sale', [], places)).toEqual({ deal: 'sale' });
    expect(parseLanding('rent', ['dubai-marina'], places)?.location).toBe('dubai/dubai-marina');
    expect(parseLanding('rent', ['studio'], places)?.bedrooms).toBe(0);
    expect(parseLanding('rent', ['villa', 'dubai-marina', 'marina-gate-1'], places)?.location).toBe(
      'dubai/dubai-marina/marina-gate-1',
    );
  });

  it('مسیر نامعتبر ۴۰۴ است', () => {
    expect(parseLanding('buy', [], places)).toBeNull();
    expect(parseLanding('rent', ['castle'], places)).toBeNull();
    expect(parseLanding('rent', ['dubai-marina', 'apartment'], places)).toBeNull(); // ترتیب ثابت است
    expect(parseLanding('rent', ['apartment', '0-bedroom'], places)).toBeNull();
    expect(parseLanding('rent', ['dubai-marina', 'nope'], places)).toBeNull();
  });

  it('landingPath عکس parseLanding است', () => {
    for (const segments of [
      ['apartment', '3-bedroom', 'business-bay'],
      ['hotel-apartment'],
      ['studio', 'dubai-marina', 'marina-gate-1'],
    ]) {
      const spec = parseLanding('rent', segments, places)!;
      expect(landingPath(spec)).toBe(`/rent/${segments.join('/')}`);
    }
  });

  it('فیلترهای ثابت لندینگ', () => {
    expect(
      landingPreset({ deal: 'rent', propertyType: 'villa', bedrooms: 0, location: 'dubai/x' }),
    ).toEqual({
      dealType: 'rent',
      propertyType: 'villa',
      bedroomsMin: '0',
      bedroomsMax: '0',
      location: 'dubai/x',
    });
  });
});

describe('search-url', () => {
  it('withPatch: حذف، آرایه، پیش‌فرض‌ها و بازنشانی صفحه', () => {
    const qs = withPatch('', { dealType: 'rent', propertyType: ['villa', 'apartment'], page: 3 });
    expect(qs).toBe('dealType=rent&page=3&propertyType=villa%2Capartment');
    // تغییر فیلتر صفحه را به ۱ برمی‌گرداند (page حذف می‌شود)
    expect(withPatch(qs, { priceMax: 100000 })).not.toContain('page=');
    // مقدار پیش‌فرض نوشته نمی‌شود
    expect(withPatch('', { sort: 'relevance', pageSize: 20 })).toBe('');
    // false و رشته‌ی خالی حذف می‌کنند
    expect(withPatch('verified=1&q=x', { verified: false, q: '' })).toBe('');
  });

  it('خروجی یکتا و مرتب است', () => {
    expect(withPatch('b=2&a=1', {})).toBe('a=1&b=2');
  });

  it('countActiveFilters: جفت min/max یک فیلتر است', () => {
    expect(countActiveFilters('priceMin=1&priceMax=2&dealType=rent&sort=newest&page=2')).toBe(2);
    expect(countActiveFilters('bedroomsMin=2&bedroomsMax=2&verified=1')).toBe(2);
  });

  it('filtersOnly: فقط فیلترها (برای نقشه و ذخیره‌ی جستجو)', () => {
    expect(filtersOnly('dealType=rent&page=3&sort=newest&view=map&bbox=1,2,3,4', ['bbox'])).toBe(
      'dealType=rent',
    );
  });
});
