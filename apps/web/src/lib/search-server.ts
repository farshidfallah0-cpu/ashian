import 'server-only';
import {
  LABELS,
  bedroomsLabel,
  formatPrice,
  searchQuerySchema,
  type SearchQuery,
  type SearchResponse,
} from '@ashian/shared';
import { apiGet } from './api';
import { FILTER_KEYS, withPatch } from './search-url';

export type RawParams = Record<string, string | string[] | undefined>;

export type ViewMode = 'auto' | 'list' | 'map' | 'split';

export interface ParsedSearch {
  query: SearchQuery;
  /** query string استاندارد و یکتا (فیلترها + sort + page + view؛ بدون پیش‌فرض‌ها) */
  qs: string;
  /** همان qs بدون پارامترهای فقط-نمایشی (view)؛ برای صدا زدن API */
  apiQs: string;
  view: ViewMode;
}

const KNOWN_KEYS = new Set<string>([
  ...FILTER_KEYS,
  'sort',
  'verifiedFirst',
  'page',
  'pageSize',
  'facets',
]);

/**
 * پارامترهای URL → کوئری معتبر. ورودی نامعتبر صفحه را نمی‌شکند: پارامتر خراب حذف می‌شود
 * (کاربر لینک قدیمی یا دست‌کاری‌شده می‌زند و باز هم نتیجه می‌بیند).
 */
export function parseSearch(raw: RawParams, preset: Record<string, string> = {}): ParsedSearch {
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!KNOWN_KEYS.has(key) || value === undefined) continue;
    entries[key] = Array.isArray(value) ? value.join(',') : value;
  }
  Object.assign(entries, preset);

  let query: SearchQuery | null = null;
  for (let attempt = 0; attempt < 6 && !query; attempt++) {
    const result = searchQuerySchema.safeParse(entries);
    if (result.success) query = result.data;
    else {
      const bad = new Set(result.error.issues.map((i) => String(i.path[0] ?? '')));
      if (bad.has('')) {
        // خطای بین‌فیلدی (مثل min > max): هر دو سر بازه حذف می‌شود
        for (const key of [
          'priceMin',
          'priceMax',
          'bedroomsMin',
          'bedroomsMax',
          'areaMin',
          'areaMax',
        ])
          delete entries[key];
      }
      for (const key of bad) delete entries[key];
    }
  }
  query ??= searchQuerySchema.parse({});

  const view: ViewMode =
    raw.view === 'list' || raw.view === 'map' || raw.view === 'split' ? raw.view : 'auto';
  const apiQs = withPatch('', entries);
  return {
    query,
    qs: withPatch(apiQs, { view: view === 'auto' ? null : view, page: query.page }),
    apiQs,
    view,
  };
}

export async function fetchSearch(qs: string): Promise<SearchResponse | null> {
  return apiGet<SearchResponse>(`/v1/search/listings?${qs}`, { revalidate: 15 });
}

/* ───────────── مکان‌ها ───────────── */

export interface PlaceInfo {
  id: string;
  type: 'emirate' | 'community' | 'tower';
  slug: string;
  path: string;
  nameFa: string;
  nameEn: string;
  listingCount: number;
}

/** فهرست مکان‌ها (کش ۵ دقیقه‌ای)؛ برای برچسب چیپ‌ها و صفحه‌های لندینگ */
export async function getPlaces(): Promise<PlaceInfo[]> {
  return (await apiGet<PlaceInfo[]>('/v1/locations', { revalidate: 300 })) ?? [];
}

/* ───────────── تیتر ───────────── */

const DEAL_NOUN: Record<string, string> = {
  rent: 'اجاره',
  sale: 'خرید',
  full_mortgage: 'رهن کامل',
  short_term: 'اجاره‌ی کوتاه‌مدت',
};

/** «دو خوابه»، «استودیو» یا مثلاً «حداقل ۳ خوابه» */
export function bedroomsPhrase(query: SearchQuery): string | null {
  const { bedroomsMin: min, bedroomsMax: max } = query;
  if (min === undefined && max === undefined) return null;
  if (min !== undefined && min === max) return bedroomsLabel(min);
  if (min !== undefined && max === undefined) return `حداقل ${bedroomsLabel(min)}`;
  if (min === undefined && max !== undefined)
    return max === 0 ? 'استودیو' : `تا ${bedroomsLabel(max)}`;
  return null;
}

/** تیتر پویا: «اجاره‌ی آپارتمان دو خوابه در دبی مارینا» */
export function buildHeading(query: SearchQuery, places: PlaceInfo[]): string {
  const deal = query.dealType?.length === 1 ? DEAL_NOUN[query.dealType[0]!] : null;
  const types = query.propertyType?.length
    ? query.propertyType.map((t) => LABELS.propertyType[t]).join(' و ')
    : null;
  const beds = bedroomsPhrase(query);
  const where =
    query.location?.length === 1 ? places.find((p) => p.path === query.location![0])?.nameFa : null;

  const noun = types ?? 'ملک';
  const prefix = deal
    ? [deal, noun, beds].filter(Boolean).join(' ')
    : types
      ? [types, beds].filter(Boolean).join(' ')
      : beds
        ? `ملک ${beds}`
        : 'آگهی‌های ملک';
  return `${prefix} در ${where ?? 'دبی'}`;
}

/* ───────────── چیپ‌های فیلتر فعال ───────────── */

export interface FilterChip {
  id: string;
  label: string;
  /** query string بعد از حذف همین فیلتر */
  removeQs: string;
}

const money = (v: number) => formatPrice(v);

export function buildChips(query: SearchQuery, qs: string, places: PlaceInfo[]): FilterChip[] {
  const chips: FilterChip[] = [];
  const add = (id: string, label: string, patch: Record<string, string | string[] | null>) =>
    chips.push({ id, label, removeQs: withPatch(qs, patch) });

  const dropValue = (list: readonly string[] | undefined, value: string) => {
    const rest = (list ?? []).filter((v) => v !== value);
    return rest.length ? rest : null;
  };

  for (const v of query.dealType ?? [])
    add(`deal:${v}`, LABELS.dealType[v], { dealType: dropValue(query.dealType, v) });
  for (const v of query.propertyType ?? [])
    add(`type:${v}`, LABELS.propertyType[v], { propertyType: dropValue(query.propertyType, v) });
  for (const path of query.location ?? []) {
    const name = places.find((p) => p.path === path)?.nameFa ?? path.split('/').pop() ?? path;
    add(`loc:${path}`, name, { location: dropValue(query.location, path) });
  }
  if (query.priceMin !== undefined || query.priceMax !== undefined) {
    const label =
      query.priceMin !== undefined && query.priceMax !== undefined
        ? `${money(query.priceMin)} تا ${money(query.priceMax)}`
        : query.priceMin !== undefined
          ? `از ${money(query.priceMin)}`
          : `تا ${money(query.priceMax!)}`;
    add('price', label, { priceMin: null, priceMax: null });
  }
  const beds = bedroomsPhrase(query);
  if (beds) add('beds', beds, { bedroomsMin: null, bedroomsMax: null });
  else if (query.bedroomsMin !== undefined)
    add('beds', `${query.bedroomsMin}+ خواب`, { bedroomsMin: null, bedroomsMax: null });
  if (query.bathroomsMin !== undefined)
    add('baths', `حداقل ${query.bathroomsMin} حمام`, { bathroomsMin: null });
  if (query.areaMin !== undefined || query.areaMax !== undefined) {
    const label =
      query.areaMin !== undefined && query.areaMax !== undefined
        ? `${query.areaMin} تا ${query.areaMax} فوت`
        : query.areaMin !== undefined
          ? `از ${query.areaMin} فوت`
          : `تا ${query.areaMax} فوت`;
    add('area', label, { areaMin: null, areaMax: null });
  }
  for (const v of query.furnishing ?? [])
    add(`furn:${v}`, LABELS.furnishing[v], { furnishing: dropValue(query.furnishing, v) });
  for (const slug of query.amenities ?? [])
    add(`am:${slug}`, slug, { amenities: dropValue(query.amenities, slug) });
  if (query.verified) add('verified', 'فقط تأییدشده', { verified: null });
  if (query.cheques) add('cheques', `${query.cheques} چک`, { cheques: null });
  if (query.parkingMin) add('parking', `پارکینگ ${query.parkingMin}+`, { parkingMin: null });
  if (query.postedWithin) add('posted', `${query.postedWithin} روز اخیر`, { postedWithin: null });
  if (query.q) add('q', `«${query.q}»`, { q: null });
  if (query.bbox) add('bbox', 'محدوده‌ی نقشه', { bbox: null });
  if (query.agentId) add('agent', 'آگهی‌های یک مشاور', { agentId: null });
  return chips;
}

/* ───────────── امکانات ───────────── */

export interface AmenityInfo {
  slug: string;
  nameFa: string;
  category: 'building' | 'unit' | 'view' | 'policy';
  icon: string | null;
}

export async function getAmenities(): Promise<AmenityInfo[]> {
  return (await apiGet<AmenityInfo[]>('/v1/amenities', { revalidate: 3600 })) ?? [];
}
