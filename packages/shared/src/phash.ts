/**
 * فاصله‌ی همینگ دو هش ۶۴ بیتی (۱۶ رقم hex)؛ هرچه کمتر، عکس‌ها شبیه‌ترند.
 * هش ناقص یا نامعتبر = بی‌نهایت (هیچ‌وقت «شبیه» حساب نمی‌شود).
 */
export function hammingHex(a: string | null | undefined, b: string | null | undefined): number {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    const na = Number.parseInt(a[i]!, 16);
    const nb = Number.parseInt(b[i]!, 16);
    if (Number.isNaN(na) || Number.isNaN(nb)) return Number.POSITIVE_INFINITY;
    const x = na ^ nb;
    distance += (x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1) + ((x >> 3) & 1);
  }
  return distance;
}

/** آستانه‌ی «همان عکس» برای dHash ۶۴ بیتی */
export const SAME_PHOTO_DISTANCE = 8;