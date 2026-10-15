import { toEnglishDigits } from './numbers.js';

// همه‌ی کاراکترهای نامرئی با escape نوشته می‌شوند تا در سورس دیده شوند.
// رجکس‌ها با RegExp ساخته می‌شوند چون ESLint روی literal حاوی این کاراکترها ایراد می‌گیرد.
const ZWNJ = '‌';
const ZWNJ_RUN = new RegExp('\\u200C{2,}', 'g');
const ZWNJ_WITH_SPACE = new RegExp('\\s*\\u200C\\s*', 'g');
const ZWNJ_ALL = new RegExp('\\u200C', 'g');

const CHAR_MAP: Record<string, string> = {
  ي: 'ی',
  ى: 'ی',
  ك: 'ک',
  ۀ: 'هٔ',
  ة: 'ه',
};
const ARABIC_CHARS = /[يىكۀة]/g;

// اعراب، تنوین، سکون، الف مقصوره‌ی کوچک، و کشیده (ـ)
const DIACRITICS = new RegExp('[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640]', 'g');
// کاراکترهای نامرئی به‌جز نیم‌فاصله
const INVISIBLE = new RegExp(
  // ZWJ (200D) خارج از کلاس است چون ESLint کاراکتر joiner داخل کلاس را مشکوک می‌داند
  '\\u200D|[\\u200B\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]',
  'g',
);

/**
 * یکسان‌سازی متن فارسی برای ذخیره‌سازی.
 * - ي/ى → ی و ك → ک
 * - ارقام فارسی و عربی → انگلیسی
 * - حذف اعراب و کشیده
 * - حفظ نیم‌فاصله، اما حذف نیم‌فاصله‌ی تکراری یا چسبیده به فاصله
 * - یکسان کردن فاصله‌ها
 */
export function normalizePersian(input: string): string {
  return toEnglishDigits(input)
    .replace(ARABIC_CHARS, (c) => CHAR_MAP[c] ?? c)
    .replace(DIACRITICS, '')
    .replace(INVISIBLE, '')
    .replace(ZWNJ_RUN, ZWNJ)
    .replace(ZWNJ_WITH_SPACE, (m) => (/\s/.test(m) ? ' ' : ZWNJ))
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

/**
 * کلید جستجو: سخت‌گیرتر از فرم ذخیره‌سازی تا «آپارتمان‌ها» و «آپارتمان ها»
 * و «اپارتمان» به یک کلید برسند. فقط برای ایندکس و کوئری استفاده شود، نه نمایش.
 */
export function normalizeForSearch(input: string): string {
  return normalizePersian(input)
    .replace(/[آأإ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/هٔ/g, 'ه')
    .replace(ZWNJ_ALL, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
