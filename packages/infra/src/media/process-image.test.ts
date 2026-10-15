import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { processImage } from './process-image.js';

async function makeJpeg(width: number, height: number, orientation?: number) {
  const image = sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 120, b: 40 } },
  });
  return image
    .jpeg()
    .withMetadata(orientation ? { orientation } : {})
    .toBuffer();
}

describe('processImage', () => {
  it('اندازه‌ها و فرمت‌ها را می‌سازد و از اصل بزرگ‌تر نمی‌شود', async () => {
    const result = await processImage(await makeJpeg(1400, 900));
    const widths = [...new Set(result.files.map((f) => f.width))].sort((a, b) => a - b);
    expect(widths).toEqual([320, 640, 960, 1280]);
    expect(result.files.filter((f) => f.format === 'avif')).toHaveLength(4);
    expect(result.files.filter((f) => f.format === 'webp')).toHaveLength(4);
    expect(result.blurhash.length).toBeGreaterThan(10);
    expect({ w: result.width, h: result.height }).toEqual({ w: 1400, h: 900 });
  }, 30_000);

  it('جهت EXIF را اعمال می‌کند (ابعاد جابه‌جا می‌شود)', async () => {
    const result = await processImage(await makeJpeg(1600, 1000, 6), { widths: [320] });
    expect({ w: result.width, h: result.height }).toEqual({ w: 1000, h: 1600 });
    const out = await sharp(result.files[0]!.body).metadata();
    expect(out.width).toBe(320);
    expect(out.height).toBe(512);
  });

  it('metadata (EXIF) را از خروجی حذف می‌کند', async () => {
    const result = await processImage(await makeJpeg(800, 600, 3), {
      widths: [640],
      formats: ['webp'],
    });
    const out = await sharp(result.files[0]!.body).metadata();
    expect(out.exif).toBeUndefined();
  });

  it('تصویر کوچک فقط با اندازه‌ی خودش تولید می‌شود', async () => {
    const result = await processImage(await makeJpeg(200, 150), { formats: ['webp'] });
    expect(result.files.map((f) => f.width)).toEqual([200]);
  });

  it('فایل غیرتصویری را رد می‌کند', async () => {
    await expect(
      processImage(Buffer.from('<html><script>alert(1)</script></html>')),
    ).rejects.toThrow();
  });
});
