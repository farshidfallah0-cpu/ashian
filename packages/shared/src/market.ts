/**
 * تنظیمات بازار. برای بردن پلتفرم به بازار دیگر (مثلاً ایران) فقط همین فایل عوض می‌شود.
 */

export type CalendarSystem = 'persian' | 'gregory';
export type AreaUnit = 'sqft' | 'sqm';

export interface MarketConfig {
  readonly code: string;
  readonly locale: string;
  readonly currency: {
    readonly code: string;
    readonly label: string;
    /** برچسب‌های مقیاس برای نمایش خوانا، از بزرگ به کوچک */
    readonly scales: ReadonlyArray<{ readonly value: number; readonly label: string }>;
  };
  readonly calendar: CalendarSystem;
  readonly timeZone: string;
  /** واحد ذخیره‌سازی متراژ در دیتابیس */
  readonly storageAreaUnit: AreaUnit;
  /** واحد اصلی نمایش؛ واحد دیگر به‌صورت فرعی نمایش داده می‌شود */
  readonly displayAreaUnit: AreaUnit;
  readonly rent: {
    readonly defaultPeriod: RentPeriod;
    readonly chequeOptions: readonly number[];
  };
  readonly phone: {
    /** کدهای کشور مجاز برای ورود با موبایل */
    readonly allowedCountryCodes: readonly string[];
    readonly defaultCountryCode: string;
  };
  readonly map: {
    readonly center: readonly [lng: number, lat: number];
    readonly zoom: number;
    /** محدوده‌ی مجاز نقطه‌ی ملک: [غرب، جنوب، شرق، شمال] (امارات) */
    readonly bounds: readonly [west: number, south: number, east: number, north: number];
  };
  /** بسته‌های ارتقای آگهی (قیمت به واحد پول بازار) */
  readonly promotion: {
    readonly featuredOptions: ReadonlyArray<{ readonly days: number; readonly price: number }>;
  };
}

export type RentPeriod = 'yearly' | 'monthly' | 'weekly' | 'daily';

export const MARKET: MarketConfig = {
  code: 'AE-DXB',
  locale: 'fa-IR',
  currency: {
    code: 'AED',
    label: 'درهم',
    scales: [
      { value: 1_000_000_000, label: 'میلیارد' },
      { value: 1_000_000, label: 'میلیون' },
      { value: 1_000, label: 'هزار' },
    ],
  },
  calendar: 'persian',
  timeZone: 'Asia/Dubai',
  storageAreaUnit: 'sqft',
  displayAreaUnit: 'sqft',
  rent: {
    defaultPeriod: 'yearly',
    chequeOptions: [1, 2, 4, 6, 12],
  },
  phone: {
    allowedCountryCodes: ['971', '98'],
    defaultCountryCode: '971',
  },
  map: {
    center: [55.2708, 25.2048],
    zoom: 10.5,
    bounds: [51.5, 22.5, 56.5, 26.2],
  },
  promotion: {
    featuredOptions: [
      { days: 7, price: 199 },
      { days: 14, price: 349 },
      { days: 30, price: 599 },
    ],
  },
};

export const RENT_PERIOD_LABEL: Record<RentPeriod, string> = {
  yearly: 'سال',
  monthly: 'ماه',
  weekly: 'هفته',
  daily: 'روز',
};
