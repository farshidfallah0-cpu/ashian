import { hammingHex } from '@ashian/shared';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { dHash } from './process-image.js';

/** تصویر آزمایشی: ساختمان‌های ساده با ارتفاع‌های مختلف روی پس‌زمینه */
function svgScene(heights: number[], size = 640) {
  const w = size / heights.length;
  const rects = heights
    .map((h, i) => `<rect x="${i * w}" y="${size - h * size}" width="${w - 6}" height="${h * size}" fill="#1B2B4B"/>`)
    .join('');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#eee"/>${rects}</svg>`,
  );
}

/** مثل عکس واقعی لبه‌های نرم دارد (لبه‌ی تیز و مصنوعی روی مرز نمونه‌برداری ناپایدار است) */
async function scene(heights: number[]) {
  return sharp(svgScene(heights)).blur(14).png().toBuffer();
}

describe('dHash', () => {
  const A = [0.9, 0.4, 0.7, 0.3, 0.8, 0.5, 0.6, 0.2];
  const B = [0.2, 0.8, 0.3, 0.9, 0.4, 0.7, 0.2, 0.6];

  it('۱۶ رقم hex می‌دهد', async () => {
    expect(await dHash(sharp(await scene(A)))).toMatch(/^[0-9a-f]{16}$/);
  });

  it('تغییر اندازه و فشرده‌سازی JPEG هش را تقریباً عوض نمی‌کند', async () => {
    const original = await dHash(sharp(await scene(A)));
    const small = await sharp(await scene(A)).resize(300).jpeg({ quality: 40 }).toBuffer();
    expect(hammingHex(original, await dHash(sharp(small)))).toBeLessThanOrEqual(6);
  });

  it('تصویر متفاوت فاصله‌ی زیاد دارد', async () => {
    const a = await dHash(sharp(await scene(A)));
    const b = await dHash(sharp(await scene(B)));
    expect(hammingHex(a, b)).toBeGreaterThan(8);
  });
});
