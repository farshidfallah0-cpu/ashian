import { IMAGE_WIDTHS, type ImageWidth, type MediaVariants } from '@ashian/shared';

/** آدرس عمومی فایل‌های رسانه (مرورگر مستقیم از API/CDN می‌گیرد؛ اندازه‌ها از قبل ساخته شده‌اند) */
const MEDIA_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000') + '/media/';

export const mediaUrl = (key: string) => MEDIA_BASE + key;

export interface ImageSources {
  avif: string | null;
  webp: string | null;
  /** بزرگ‌ترین WebP؛ برای مرورگرهای بدون srcset در <img> */
  fallback: string | null;
}

function srcSet(
  files: Partial<Record<number, string>> | undefined,
  widths: readonly ImageWidth[],
): string | null {
  if (!files) return null;
  const parts = widths.flatMap((w) => (files[w] ? [`${mediaUrl(files[w]!)} ${w}w`] : []));
  return parts.length ? parts.join(', ') : null;
}

/**
 * srcset از روی variants. `widths` برای جاهایی است که لازم نیست همه‌ی اندازه‌ها در HTML بیایند
 * (مثلاً لایت‌باکس فقط ۳ عرض می‌خواهد تا payload صفحه سبک بماند).
 */
export function imageSources(
  variants: MediaVariants | null | undefined,
  widths: readonly ImageWidth[] = IMAGE_WIDTHS,
): ImageSources | null {
  if (!variants) return null;
  const avif = srcSet(variants.avif, widths);
  const webp = srcSet(variants.webp, widths);
  if (!avif && !webp) return null;
  const widest = [...widths].reverse().find((w) => variants.webp?.[w]);
  const mid = widths.find((w) => w >= 640 && variants.webp?.[w]) ?? widest;
  return {
    avif,
    webp,
    fallback: mid && variants.webp?.[mid] ? mediaUrl(variants.webp[mid]!) : null,
  };
}
