/**
 * شناسه‌ی عمومی کوتاه و غیرقابل حدس برای URL آگهی.
 * ۱۰ کاراکتر base58 ≈ ۵۸^۱۰ ≈ ۴×۱۰^۱۷ حالت؛ شمارش و حدس زدن عملی نیست.
 * کاراکترهای گیج‌کننده (0 O I l) حذف شده‌اند تا هنگام خواندن و تایپ اشتباه نشود.
 */
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const LENGTH = 10;

/** عدد تصادفی بدون سوگیری با rejection sampling */
function randomIndexes(count: number): number[] {
  const out: number[] = [];
  const limit = 256 - (256 % ALPHABET.length);
  while (out.length < count) {
    const bytes = new Uint8Array(count * 2);
    globalThis.crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < limit && out.length < count) out.push(b % ALPHABET.length);
    }
  }
  return out;
}

export function generatePublicId(length = LENGTH): string {
  return randomIndexes(length)
    .map((i) => ALPHABET[i]!)
    .join('');
}

const PUBLIC_ID_RE = new RegExp(`^[${ALPHABET}]{${LENGTH}}$`);

export function isPublicId(value: string): boolean {
  return PUBLIC_ID_RE.test(value);
}

/**
 * ساخت slug لاتین از نام انگلیسی (برای آدرس محله و آژانس).
 * فارسی در URL نگه داشته نمی‌شود تا لینک‌ها کوتاه و قابل کپی بمانند.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
