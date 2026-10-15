import { MARKET, type CalendarSystem } from './market.js';
import { formatNumber } from './numbers.js';

const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(calendar: CalendarSystem, options: Intl.DateTimeFormatOptions) {
  const key = `${calendar}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(`fa-IR-u-ca-${calendar}-nu-arabext`, {
      timeZone: MARKET.timeZone,
      ...options,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

export type DateStyle = 'long' | 'short' | 'numeric';

const STYLE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  short: { day: 'numeric', month: 'long' },
  numeric: { day: '2-digit', month: '2-digit', year: 'numeric' },
};

/**
 * تاریخ را با تقویم بازار نمایش می‌دهد.
 *   long    → «۱۴ مهر ۱۴۰۵»
 *   short   → «۱۴ مهر»
 *   numeric → «۱۴۰۵/۰۷/۱۴»
 */
export function formatDate(
  date: Date | string | number,
  style: DateStyle = 'long',
  calendar: CalendarSystem = MARKET.calendar,
): string {
  const value = date instanceof Date ? date : new Date(date);
  return getFormatter(calendar, STYLE_OPTIONS[style]).format(value);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * زمان نسبی کوتاه برای کارت آگهی: «همین حالا»، «۵ دقیقه پیش»، «دیروز»، «۳ روز پیش»
 * بیشتر از ۶۰ روز → تاریخ کامل
 */
export function formatRelative(date: Date | string | number, now: Date = new Date()): string {
  const value = date instanceof Date ? date : new Date(date);
  const diff = now.getTime() - value.getTime();

  if (diff < MINUTE) return 'همین حالا';
  if (diff < HOUR) return `${formatNumber(Math.floor(diff / MINUTE), 0)} دقیقه پیش`;
  if (diff < DAY) return `${formatNumber(Math.floor(diff / HOUR), 0)} ساعت پیش`;

  const days = Math.floor(diff / DAY);
  if (days === 1) return 'دیروز';
  if (days < 7) return `${formatNumber(days, 0)} روز پیش`;
  if (days < 30) return `${formatNumber(Math.floor(days / 7), 0)} هفته پیش`;
  if (days < 60) return 'یک ماه پیش';
  return formatDate(value, 'long');
}
