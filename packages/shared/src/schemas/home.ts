import type { FacetOption, SearchCard } from './search.js';
import type { MediaVariants } from './media.js';

/** پاسخ `GET /v1/home`: همه‌ی داده‌ی ویترین صفحه‌ی اصلی در یک درخواست (کش‌شده) */

export interface HomeCommunity {
  slug: string;
  /** مسیر مکان برای فیلتر جستجو: «dubai/dubai-marina» */
  path: string;
  nameFa: string;
  nameEn: string;
  listingCount: number;
  /** میانگین قیمت هر فوت مربع برای فروش (درهم)؛ null اگر آگهی فروش ندارد */
  avgSalePricePerSqft: number | null;
  /** میانگین اجاره‌ی سالانه (درهم)؛ null اگر آگهی اجاره ندارد */
  avgYearlyRent: number | null;
  cover: {
    variants: MediaVariants | null;
    blurhash: string | null;
    width: number | null;
    height: number | null;
  } | null;
}

export interface HomeResponse {
  stats: { listings: number; communities: number; agents: number };
  /** تعداد آگهی هر نوع ملک، جدا برای اجاره و خرید (برای میانبرها و تب جستجو) */
  propertyTypes: { rent: FacetOption[]; sale: FacetOption[] };
  communities: HomeCommunity[];
  /** تازه‌ترین آگهی‌های تأییدشده */
  latestVerified: SearchCard[];
  /** اجاره‌ها و خریدهای منتخب (بالاترین امتیاز کیفیت و تازگی)، بدون جایگاه تبلیغی */
  rentPicks: SearchCard[];
  salePicks: SearchCard[];
  generatedAt: string;
}
