import { describe, expect, it } from 'vitest';
import { generatePublicId, isPublicId, slugify } from '../public-id.js';
import { verifyOtpSchema } from './auth.js';
import { phoneSchema } from './common.js';
import {
  createListingSchema,
  detectQualityWarnings,
  updateListingSchema,
  validateListingPartial,
} from './listing.js';
import { presignMediaSchema } from './media.js';

describe('phoneSchema', () => {
  it.each([
    ['+971 50 123 4567', '971501234567'],
    ['۰۰۹۷۱۵۰۱۲۳۴۵۶۷', '971501234567'],
    ['050-123-4567', '971501234567'],
    ['+98 912 345 6789', '989123456789'],
    ['٩٧١٥٠١٢٣٤٥٦٧', '971501234567'],
  ])('«%s» → %s', (input, expected) => {
    expect(phoneSchema.parse(input)).toBe(expected);
  });

  it.each(['abc', '123', '+1 202 555 0100', ''])('«%s» رد می‌شود', (input) => {
    expect(phoneSchema.safeParse(input).success).toBe(false);
  });
});

describe('verifyOtpSchema', () => {
  it('کد با ارقام فارسی را می‌پذیرد', () => {
    const r = verifyOtpSchema.parse({ phone: '0501234567', code: '۱۲۳۴۵' });
    expect(r.code).toBe('12345');
  });
  it('طول نادرست رد می‌شود', () => {
    expect(verifyOtpSchema.safeParse({ phone: '0501234567', code: '123' }).success).toBe(false);
  });
});

describe('publicId', () => {
  it('طول و الفبای درست دارد و تکراری نمی‌شود', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => generatePublicId()));
    expect(ids.size).toBe(5000);
    for (const id of ids) expect(isPublicId(id)).toBe(true);
  });
  it('کاراکتر گیج‌کننده ندارد', () => {
    const joined = Array.from({ length: 500 }, () => generatePublicId()).join('');
    expect(joined).not.toMatch(/[0OIl]/);
  });
  it('slugify', () => {
    expect(slugify('Dubai Marina')).toBe('dubai-marina');
    expect(slugify('Jumeirah Village Circle (JVC)')).toBe('jumeirah-village-circle-jvc');
  });
});

const valid = {
  dealType: 'rent' as const,
  propertyType: 'apartment' as const,
  locationId: '3f8e1a52-6a0e-4b7a-9d34-0c3b1a9a9a11',
  title: 'دو خوابه‌ی مبله در دبی مارینا',
  price: 125_000,
  bedrooms: 2,
  bathrooms: 2,
  areaSqft: 1150,
  furnishing: 'furnished' as const,
};

describe('createListingSchema', () => {
  it('ورودی معتبر را می‌پذیرد و پیش‌فرض‌ها را پر می‌کند', () => {
    const r = createListingSchema.parse(valid);
    expect(r.description).toBe('');
    expect(r.rentCheques).toEqual([]);
    expect(r.amenityIds).toEqual([]);
  });

  it('متن فارسی را یکسان‌سازی می‌کند', () => {
    const r = createListingSchema.parse({ ...valid, title: 'دو خوابه‌ي مبله در دبي مارينا' });
    expect(r.title).toBe('دو خوابه‌ی مبله در دبی مارینا');
  });

  it('متراژ غیرواقعی (تاون‌هاوس ۴۱ هزار فوت) در محدوده‌ی مجاز می‌ماند ولی هشدار می‌گیرد', () => {
    expect(
      detectQualityWarnings({
        dealType: 'sale',
        price: 3_000_000,
        bedrooms: 4,
        areaSqft: 41_000,
      }).map((w) => w.code),
    ).toContain('area_unusual');
  });

  it('متراژ بیش از حد مجاز رد می‌شود', () => {
    expect(createListingSchema.safeParse({ ...valid, areaSqft: 500_000 }).success).toBe(false);
  });

  it('خواب نامتناسب با متراژ رد می‌شود', () => {
    expect(createListingSchema.safeParse({ ...valid, bedrooms: 5, areaSqft: 400 }).success).toBe(
      false,
    );
  });

  it('قیمت اجاره‌ی خارج از بازه رد می‌شود', () => {
    expect(createListingSchema.safeParse({ ...valid, price: 100 }).success).toBe(false);
  });
});

describe('detectQualityWarnings', () => {
  it('آگهی عادی هشدار ندارد', () => {
    expect(
      detectQualityWarnings({ dealType: 'rent', price: 125_000, bedrooms: 2, areaSqft: 1150 }),
    ).toEqual([]);
  });

  it('قیمت هر فوت فروش غیرعادی', () => {
    const w = detectQualityWarnings({
      dealType: 'sale',
      price: 200_000,
      bedrooms: 2,
      areaSqft: 1200,
    });
    expect(w.map((x) => x.code)).toContain('price_per_sqft_unusual');
  });

  it('مقایسه با میانگین محله', () => {
    const base = { dealType: 'sale' as const, price: 3_000_000, bedrooms: 2, areaSqft: 1200 }; // 2500/ft²
    expect(detectQualityWarnings(base, 2400)).toEqual([]);
    expect(detectQualityWarnings(base, 800).map((x) => x.code)).toContain('price_per_sqft_unusual');
  });

  it('خواب زیاد در متراژ کم', () => {
    const w = detectQualityWarnings({
      dealType: 'rent',
      price: 150_000,
      bedrooms: 4,
      areaSqft: 900,
    });
    expect(w.map((x) => x.code)).toContain('beds_vs_area');
  });
});

describe('presignMediaSchema', () => {
  const base = { listingPublicId: 'UTJmYP8Q36', contentType: 'image/jpeg', sizeBytes: 2_000_000 };
  it('عکس معتبر', () => {
    expect(presignMediaSchema.safeParse(base).success).toBe(true);
  });
  it('نوع فایل غیرمجاز (svg و html) رد می‌شود', () => {
    expect(presignMediaSchema.safeParse({ ...base, contentType: 'image/svg+xml' }).success).toBe(
      false,
    );
    expect(presignMediaSchema.safeParse({ ...base, contentType: 'text/html' }).success).toBe(false);
  });
  it('حجم زیاد رد می‌شود', () => {
    expect(presignMediaSchema.safeParse({ ...base, sizeBytes: 50 * 1024 * 1024 }).success).toBe(
      false,
    );
  });
});

describe('updateListingSchema (ویرایش جزئی)', () => {
  it('فیلدهای نیامده را هیچ‌وقت با پیش‌فرض نمی‌سازد (PATCH قیمت چیز دیگری را پاک نکند)', () => {
    const parsed = updateListingSchema.parse({ price: 90000 });
    expect(parsed).toEqual({ price: 90000 });
    for (const key of ['lng', 'lat', 'description', 'amenityIds', 'rentCheques', 'deposit', 'parkingSpaces']) {
      expect(parsed).not.toHaveProperty(key);
    }
  });
  it('فیلدی که فرستاده شده (حتی null) حفظ می‌شود', () => {
    expect(updateListingSchema.parse({ floor: null, description: '' })).toEqual({ floor: null, description: '' });
  });
  it('خطای قاعده‌ها هنوز اعمال می‌شود', () => {
    expect(updateListingSchema.safeParse({ lng: 10 }).success).toBe(false);
  });
});

describe('validateListingPartial', () => {
  it('فقط فیلدهای فرستاده‌شده را بررسی می‌کند', () => {
    expect(validateListingPartial({})).toEqual({ errors: {}, warnings: [] });
    expect(validateListingPartial({ dealType: 'rent', price: 10 }).errors.price).toBeTruthy();
  });
  it('هشدار غیرعادی بدون خطا', () => {
    const r = validateListingPartial({ dealType: 'sale', price: 3_000_000, bedrooms: 4, areaSqft: 41_000 });
    expect(r.errors).toEqual({});
    expect(r.warnings.some((w) => w.code === 'area_unusual')).toBe(true);
  });
});