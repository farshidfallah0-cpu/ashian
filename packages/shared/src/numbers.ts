const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const NON_LATIN_DIGIT = /[۰-۹٠-٩]/g;
const LATIN_DIGIT = /[0-9]/g;

/** ارقام فارسی و عربی را به انگلیسی تبدیل می‌کند (فرم ذخیره‌سازی). */
export function toEnglishDigits(input: string): string {
  return input.replace(NON_LATIN_DIGIT, (d) => {
    const p = PERSIAN_DIGITS.indexOf(d);
    return String(p >= 0 ? p : ARABIC_DIGITS.indexOf(d));
  });
}

/** ارقام انگلیسی و عربی را به فارسی تبدیل می‌کند (فرم نمایش). */
export function toPersianDigits(input: string | number): string {
  return toEnglishDigits(String(input)).replace(LATIN_DIGIT, (d) => PERSIAN_DIGITS[Number(d)]!);
}

/**
 * یک عدد تایپ‌شده توسط کاربر را می‌خواند؛ ارقام فارسی، عربی و انگلیسی
 * و جداکننده‌های هزارگان (، , ٬) را می‌پذیرد. ممیز می‌تواند . یا ٫ باشد.
 * اگر ورودی عدد معتبر نباشد null برمی‌گرداند.
 */
export function parseNumber(input: string): number | null {
  const cleaned = toEnglishDigits(input.trim())
    .replace(/[\s,،٬']/g, '')
    .replace(/٫/g, '.')
    .replace(/^[−–]/, '-');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

const groupedFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });

/** عدد را با ارقام فارسی و جداکننده‌ی هزارگان نمایش می‌دهد: ۱۲۳٬۴۵۶ */
export function formatNumber(value: number, maximumFractionDigits = 2): string {
  if (maximumFractionDigits === 2) return groupedFormatter.format(value);
  return new Intl.NumberFormat('fa-IR', { maximumFractionDigits }).format(value);
}
