import { z } from 'zod';
import {
  DEAL_TYPES,
  FURNISHING_TYPES,
  PROPERTY_TYPES,
  type DealType,
  type Furnishing,
  type ListingTier,
  type PropertyType,
} from '../domain.js';
import type { MediaVariants } from './media.js';
import { normalizePersian } from '../normalize.js';
import { parseNumber } from '../numbers.js';

/**
 * قرارداد جستجو بین API و فرانت. هر فیلتر یک پارامتر URL است تا نتیجه قابل اشتراک
 * و برگشت‌پذیر باشد. ارقام فارسی و عربی در همه‌ی عددها پذیرفته می‌شوند.
 */

export const SEARCH_SORTS = [
  'relevance',
  'newest',
  'price_asc',
  'price_desc',
  'area_desc',
] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const SEARCH_SORT_LABELS: Record<SearchSort, string> = {
  relevance: 'مرتبط‌ترین',
  newest: 'جدیدترین',
  price_asc: 'ارزان‌ترین',
  price_desc: 'گران‌ترین',
  area_desc: 'بیشترین متراژ',
};

export const POSTED_WITHIN_DAYS = [1, 3, 7, 14, 30] as const;

/** حداکثر آگهی ویژه در هر صفحه‌ی نتایج (قانون محصول) */
export const MAX_FEATURED_PER_PAGE = 3;
/** حداکثر آگهی پشت‌سرهم از یک مشاور (قانون محصول) */
export const MAX_AGENT_RUN = 2;
export const SEARCH_MAX_PAGE_SIZE = 50;

/** حدود bbox نقشه: [غرب، جنوب، شرق، شمال] */
export type BoundingBox = readonly [west: number, south: number, east: number, north: number];

const numberParam = (min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .transform((v, ctx) => {
      const n = typeof v === 'number' ? v : parseNumber(v);
      if (n === null) {
        ctx.addIssue({ code: 'custom', message: 'عدد نامعتبر است' });
        return z.NEVER;
      }
      return n;
    })
    .pipe(z.number().min(min).max(max));

const intParam = (min: number, max: number) => numberParam(min, max).pipe(z.number().int());

/** لیست جداشده با ویرگول («a,b») یا پارامتر تکراری (?a=1&a=2) */
const listParam = <T extends z.ZodType<unknown, string>>(item: T, max = 30) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((v) =>
      (Array.isArray(v) ? v : [v])
        .flatMap((s) => s.split(','))
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(item).max(max));

const boolParam = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === '1' || v === 'true');

/** bbox به‌صورت «west,south,east,north» */
export const bboxParam = z.string().transform((v, ctx): BoundingBox => {
  const parts = v.split(',').map((p) => parseNumber(p));
  if (parts.length !== 4 || parts.some((p) => p === null)) {
    ctx.addIssue({ code: 'custom', message: 'bbox باید چهار عدد باشد: west,south,east,north' });
    return z.NEVER;
  }
  const [west, south, east, north] = parts as [number, number, number, number];
  if (south >= north || west >= east || south < -90 || north > 90 || west < -180 || east > 180) {
    ctx.addIssue({ code: 'custom', message: 'bbox نامعتبر است' });
    return z.NEVER;
  }
  return [west, south, east, north];
});

const filterShape = {
  /** متن آزاد: نام محله، برج، مشاور یا کد آگهی */
  q: z
    .string()
    .transform((v) => normalizePersian(v).slice(0, 100))
    .optional(),
  dealType: listParam(z.enum(DEAL_TYPES), DEAL_TYPES.length).optional(),
  propertyType: listParam(z.enum(PROPERTY_TYPES), PROPERTY_TYPES.length).optional(),
  /** مسیر مکان‌ها: «dubai/dubai-marina» یا «dubai/dubai-marina/marina-gate-1»؛ همه‌ی زیرمجموعه‌ها را شامل می‌شود */
  location: listParam(z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+){0,2}$/), 20).optional(),
  priceMin: numberParam(0, 1e10).optional(),
  priceMax: numberParam(0, 1e10).optional(),
  bedroomsMin: intParam(0, 12).optional(),
  bedroomsMax: intParam(0, 12).optional(),
  bathroomsMin: intParam(0, 14).optional(),
  areaMin: numberParam(0, 1e6).optional(),
  areaMax: numberParam(0, 1e6).optional(),
  furnishing: listParam(z.enum(FURNISHING_TYPES), FURNISHING_TYPES.length).optional(),
  /** slug امکانات؛ همه‌ی موارد باید وجود داشته باشند (AND) */
  amenities: listParam(z.string().regex(/^[a-z0-9-]+$/), 12).optional(),
  /** فقط آگهی‌های تأییدشده */
  verified: boolParam.optional(),
  agentId: z.uuid().optional(),
  /** اجاره: آگهی‌هایی که این تعداد چک را می‌پذیرند */
  cheques: intParam(1, 12).optional(),
  parkingMin: intParam(0, 10).optional(),
  postedWithin: intParam(1, 365).optional(),
};

type RangeFields = {
  priceMin?: number;
  priceMax?: number;
  bedroomsMin?: number;
  bedroomsMax?: number;
  areaMin?: number;
  areaMax?: number;
};

const rangesAreValid = (v: RangeFields) =>
  (v.priceMin === undefined || v.priceMax === undefined || v.priceMin <= v.priceMax) &&
  (v.bedroomsMin === undefined || v.bedroomsMax === undefined || v.bedroomsMin <= v.bedroomsMax) &&
  (v.areaMin === undefined || v.areaMax === undefined || v.areaMin <= v.areaMax);

const RANGE_MESSAGE = { message: 'بازه‌ی فیلتر نامعتبر است (حداقل بزرگ‌تر از حداکثر)' };

export const searchFiltersSchema = z.object(filterShape).refine(rangesAreValid, RANGE_MESSAGE);

export const searchQuerySchema = z
  .object({
    ...filterShape,
    sort: z.enum(SEARCH_SORTS).default('relevance'),
    /** «تأییدشده‌ها اول»: آگهی‌های تأییدشده در هر مرتب‌سازی بالاتر می‌نشینند */
    verifiedFirst: boolParam.default(false),
    /** محدوده‌ی نقشه (اختیاری): فقط آگهی‌های داخل آن */
    bbox: bboxParam.optional(),
    /** facet و تعداد هر گزینه؛ برای صفحه‌های بعدی لازم نیست */
    facets: boolParam.default(true),
    page: intParam(1, 500).default(1),
    pageSize: intParam(1, SEARCH_MAX_PAGE_SIZE).default(20),
  })
  .refine(rangesAreValid, RANGE_MESSAGE);

export type SearchFilters = z.infer<typeof searchFiltersSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** جستجوی نقشه: همان فیلترها + محدوده‌ی دید و زوم */
export const mapQuerySchema = z
  .object({
    ...filterShape,
    verifiedFirst: boolParam.default(false),
    bbox: bboxParam,
    zoom: numberParam(0, 22).default(11),
  })
  .refine(rangesAreValid, RANGE_MESSAGE);
export type MapQuery = z.infer<typeof mapQuerySchema>;

export const suggestQuerySchema = z.object({
  q: z.string().transform((v) => normalizePersian(v).slice(0, 60)),
  limit: intParam(1, 12).default(8),
});
export type SuggestQuery = z.infer<typeof suggestQuerySchema>;

/** ساخت query string استاندارد از فیلترها؛ ترتیب ثابت تا کلید کش و URL پایدار باشد */
export function serializeSearchQuery(query: Partial<SearchQuery>): string {
  const params = new URLSearchParams();
  const keys = Object.keys(filterShape).concat([
    'sort',
    'verifiedFirst',
    'bbox',
    'facets',
    'page',
    'pageSize',
  ]);
  for (const key of keys.sort()) {
    const value = (query as Record<string, unknown>)[key];
    if (key === 'facets') {
      if (value === false) params.set('facets', '0');
      continue;
    }
    if (key === 'bbox') {
      if (Array.isArray(value)) params.set('bbox', value.join(','));
      continue;
    }
    if (value === undefined || value === null || value === false || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, [...value].sort().join(','));
    } else if (value === true) {
      params.set(key, '1');
    } else {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

/* ───────────── شکل پاسخ‌ها ───────────── */

export interface SearchCard {
  publicId: string;
  code: number;
  dealType: DealType;
  propertyType: PropertyType;
  tier: ListingTier;
  isVerified: boolean;
  title: string;
  price: number;
  pricePerSqft: number;
  bedrooms: number;
  bathrooms: number;
  areaSqft: number;
  furnishing: Furnishing;
  rentCheques: number[];
  publishedAt: string | null;
  community: { slug: string; nameFa: string; nameEn: string };
  /** نام برج/مجتمع اگر آگهی دقیق‌تر از محله باشد */
  tower: { slug: string; nameFa: string; nameEn: string } | null;
  coordinates: { lng: number; lat: number };
  cover: {
    variants: MediaVariants | null;
    blurhash: string | null;
    width: number | null;
    height: number | null;
  } | null;
  photoCount: number;
  /** چند عکس اول برای گالری کارت (فقط عرض‌های ۶۴۰ و ۹۶۰)؛ شامل کاور */
  photos: Array<{
    variants: MediaVariants;
    blurhash: string | null;
    width: number | null;
    height: number | null;
  }>;
  /** وجود رسانه‌ی ویژه برای نشان‌های کارت */
  media: { video: boolean; tour360: boolean; floorplan: boolean };
  agent: {
    id: string;
    name: string;
    avatarKey: string | null;
    isVerified: boolean;
    isTopAgent: boolean;
    agencyName: string | null;
  } | null;
}

export interface SearchHit extends SearchCard {
  /** در جایگاه ثابت «ویژه» نشسته است (برچسب «ویژه» باید نمایش داده شود) */
  placement: 'featured' | 'organic';
}

export interface FacetOption {
  value: string;
  count: number;
}

export interface SearchFacets {
  dealType: FacetOption[];
  propertyType: FacetOption[];
  /** مقدار = تعداد خواب («0» = استودیو) */
  bedrooms: FacetOption[];
  furnishing: FacetOption[];
  /** مقدار = slug محله */
  community: FacetOption[];
  /** مقدار = slug امکانات */
  amenities: FacetOption[];
  /** مقدار = تعداد چک */
  cheques: FacetOption[];
  verified: { verified: number; total: number };
  price: { min: number; max: number } | null;
  /** توزیع قیمت برای هیستوگرام فیلتر: لبه‌ها لگاریتمی‌اند؛ counts[i] = آگهی بین edges[i] و edges[i+1] */
  priceHistogram: { edges: number[]; counts: number[] } | null;
  areaSqft: { min: number; max: number } | null;
}

export interface SearchResponse {
  items: SearchHit[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  /** null وقتی facets=0 باشد */
  facets: SearchFacets | null;
  /** زمان پردازش موتور جستجو به میلی‌ثانیه (برای پایش) */
  tookMs: number;
}

export interface MapCluster {
  lng: number;
  lat: number;
  count: number;
}

export interface MapPin {
  publicId: string;
  lng: number;
  lat: number;
  price: number;
  dealType: DealType;
  propertyType: PropertyType;
  isVerified: boolean;
  tier: ListingTier;
}

export interface MapResponse {
  total: number;
  /** گروه‌های پین در زوم‌های دور (هر گروه ≥ ۲ آگهی) */
  clusters: MapCluster[];
  /** پین‌های تکی */
  pins: MapPin[];
  /** اگر محدوده بیش از سقف پین داشت، فقط بخشی نمایش داده شده است */
  truncated: boolean;
}

export type SuggestKind = 'community' | 'tower' | 'agent' | 'agency' | 'listing';

export interface SuggestItem {
  kind: SuggestKind;
  /** شناسه‌ی قابل‌استفاده در لینک: مسیر مکان، slug آژانس، شناسه‌ی مشاور یا شناسه‌ی عمومی آگهی */
  ref: string;
  label: string;
  /** عنوان دوم: محله‌ی والد، آژانس مشاور … */
  sublabel: string | null;
  listingCount: number;
}

export interface SuggestResponse {
  items: SuggestItem[];
  tookMs: number;
}
