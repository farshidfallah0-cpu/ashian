import {
  IMAGE_WIDTHS,
  type ImageFormat,
  type ImageWidth,
  type MediaVariants,
} from '@ashian/shared';
import { encode } from 'blurhash';
import sharp, { type Sharp } from 'sharp';
import type { ObjectStorage } from '../storage/types.js';

export interface ProcessedImage {
  width: number;
  height: number;
  blurhash: string;
  /** dHash ۶۴ بیتی به‌صورت ۱۶ رقم hex (تشخیص عکس تکراری) */
  phash: string;
  files: Array<{ format: ImageFormat; width: ImageWidth | number; body: Buffer }>;
}

const CONTENT_TYPE: Record<ImageFormat, string> = { avif: 'image/avif', webp: 'image/webp' };

/**
 * تصویر خام را به همه‌ی اندازه‌ها و فرمت‌های وب تبدیل می‌کند:
 * - جهت EXIF اعمال و سپس تمام metadata (از جمله GPS) حذف می‌شود (sharp به‌طور پیش‌فرض حذف می‌کند)
 * - AVIF و WebP در عرض‌های ۳۲۰ تا ۱۹۲۰ (هیچ‌وقت بزرگ‌تر از اصل)
 * - blurhash برای جای‌نگهدار حین بارگذاری
 * ورودی نامعتبر (غیرتصویر، خراب، بیش از حد بزرگ) خطا می‌دهد.
 */
export async function processImage(
  input: Buffer,
  options: { widths?: readonly number[]; formats?: readonly ImageFormat[] } = {},
): Promise<ProcessedImage> {
  const widths = options.widths ?? IMAGE_WIDTHS;
  const formats = options.formats ?? (['avif', 'webp'] as const);

  // محدودیت پیکسل در برابر «decompression bomb»
  const source = () => sharp(input, { failOn: 'error', limitInputPixels: 80_000_000 }).rotate();
  const meta = await sharp(input, { limitInputPixels: 80_000_000 }).metadata();
  if (!meta.width || !meta.height) throw new Error('تصویر نامعتبر است');

  const swapped = (meta.orientation ?? 1) >= 5;
  const width = swapped ? meta.height : meta.width;
  const height = swapped ? meta.width : meta.height;

  // عرض‌هایی که از اصل کوچک‌ترند؛ اگر اصل از همه کوچک‌تر بود فقط خودش
  const targets = [...new Set(widths.filter((w) => w <= width))];
  if (targets.length === 0) targets.push(width);

  const files: ProcessedImage['files'] = [];
  for (const target of targets) {
    for (const format of formats) {
      const resized = source().resize({ width: target, withoutEnlargement: true });
      const body =
        format === 'avif'
          ? await resized.avif({ quality: 52, effort: 3 }).toBuffer()
          : await resized.webp({ quality: 78, effort: 4 }).toBuffer();
      files.push({ format, width: target, body });
    }
  }

  const { data, info } = await source()
    .resize(32, 32, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const blurhash = encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);

  return { width, height, blurhash, phash: await dHash(source()), files };
}

/**
 * هش ادراکی «اختلاف» (dHash): تصویر به ۹×۸ خاکستری کوچک می‌شود و هر پیکسل با همسایه‌ی راستش
 * مقایسه می‌شود (۶۴ بیت). برش، تغییر اندازه، فشرده‌سازی و تغییر جزئی نور آن را تقریباً عوض نمی‌کند؛
 * فاصله‌ی همینگ دو هش کمتر از ~۸ یعنی احتمالاً یک عکس.
 */
const TIE_MARGIN = 4;

export async function dHash(image: Sharp): Promise<string> {
  const { data, info } = await image
    .clone()
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[(y * 9 + x) * info.channels]!;
      const right = data[(y * 9 + x + 1) * info.channels]!;
      // آستانه‌ی کوچک: در ناحیه‌های تخت، نویز فشرده‌سازی نباید بیت را برگرداند
      bits += left - right > TIE_MARGIN ? '1' : '0';
    }
  }
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** پردازش و ذخیره‌ی همه‌ی variants زیر یک prefix؛ برمی‌گرداند آنچه باید در دیتابیس بنشیند */
export async function processAndStoreImage(storage: ObjectStorage, input: Buffer, prefix: string) {
  const processed = await processImage(input);
  const variants: MediaVariants = {};

  await Promise.all(
    processed.files.map(async (file) => {
      const key = `${prefix}/${file.width}.${file.format}`;
      await storage.put(key, file.body, CONTENT_TYPE[file.format]);
      const byFormat = (variants[file.format] ??= {});
      byFormat[file.width as ImageWidth] = key;
    }),
  );

  return {
    width: processed.width,
    height: processed.height,
    blurhash: processed.blurhash,
    phash: processed.phash,
    variants,
  };
}
