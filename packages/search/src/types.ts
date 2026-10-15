import type {
  BoundingBox,
  MapPin,
  SearchCard,
  SearchFacets,
  SearchFilters,
  SearchSort,
  SuggestItem,
} from '@ashian/shared';

/**
 * سند ایندکس آگهی. تخت و مستقل از دیتابیس است: کارت نمایشی (card) هم داخل سند می‌آید
 * تا پاسخ جستجو هیچ‌وقت به PostgreSQL نیاز نداشته باشد.
 * مقدارهای زمانی unix ثانیه‌اند؛ مختصات به‌صورت [lat, lng] (قرارداد Typesense).
 */
export interface ListingDoc {
  /** شناسه‌ی عمومی آگهی */
  id: string;
  code: number;
  dealType: string;
  propertyType: string;
  furnishing: string;
  tier: 'standard' | 'featured';
  /** ۱ = تأییدشده (عددی تا هم فیلتر و هم مرتب‌سازی شود) */
  verified: 0 | 1;
  price: number;
  pricePerSqft: number;
  bedrooms: number;
  bathrooms: number;
  areaSqft: number;
  parkingSpaces: number;
  photoCount: number;
  rentCheques: number[];
  /** slug امکانات */
  amenities: string[];
  /** همه‌ی پیشوندهای مسیر مکان: [«dubai»، «dubai/marina»، «dubai/marina/gate-1»] */
  locationPaths: string[];
  communitySlug: string;
  /** خالی = آگهی بدون مشاور */
  agentId: string;
  qualityScore: number;
  rankScore: number;
  publishedAt: number;
  expiresAt: number;
  location: [lat: number, lng: number];
  geohash3: string;
  geohash4: string;
  geohash5: string;
  geohash6: string;
  /** متن‌های یکسان‌شده برای جستجو (normalizeForSearch) */
  searchTitle: string;
  searchPlace: string;
  searchAgent: string;
  searchExtra: string;
  /** JSON کارت آگهی (SearchCard) */
  card: string;
}

export interface SuggestDoc {
  id: string;
  kind: SuggestItem['kind'];
  ref: string;
  label: string;
  sublabel: string;
  searchText: string;
  listingCount: number;
}

/** پارامترهای مشترک همه‌ی پرس‌وجوها */
export interface ScopeQuery {
  filters: SearchFilters;
  /** متن یکسان‌شده؛ خالی = همه */
  text: string;
  /** جستجوی دقیق با کد آگهی */
  code?: number;
  /** فقط یک تیر (مثلاً ویژه‌ها) */
  tier?: ListingDoc['tier'];
  bbox?: BoundingBox;
  /** زمان مرجع (unix ثانیه) برای فیلتر انقضا و «تازه‌ها» */
  now: number;
}

export interface EngineSearchQuery extends ScopeQuery {
  sort: SearchSort;
  verifiedFirst: boolean;
  offset: number;
  limit: number;
  /** light: فقط id و مشاور. full: کل سند */
  fields: 'light' | 'full';
  facets?: boolean;
}

export interface EngineHit {
  id: string;
  agentId: string;
  /** فقط وقتی fields = full */
  doc?: ListingDoc;
}

export interface EngineSearchResult {
  found: number;
  hits: EngineHit[];
  facets?: SearchFacets;
  tookMs: number;
}

export interface GeoCell {
  hash: string;
  count: number;
}

export interface GeoCellsResult {
  found: number;
  cells: GeoCell[];
  /** تعداد سلول‌ها بیش از سقف بود و بعضی حذف شدند */
  truncated: boolean;
}

export interface EngineStats {
  kind: 'memory' | 'typesense';
  listings: number;
  suggestions: number;
  ready: boolean;
}

/** جلسه‌ی ساخت ایندکس تازه؛ تا commit روی ایندکس زنده اثری ندارد */
export interface ReindexSession {
  addListings(docs: ListingDoc[]): Promise<void>;
  addSuggestions(docs: SuggestDoc[]): Promise<void>;
  /** جایگزینی اتمیک ایندکس زنده با ایندکس تازه */
  commit(): Promise<void>;
  abort(): Promise<void>;
}

/**
 * قرارداد موتور جستجو. منطق برنامه فقط با این interface کار می‌کند؛
 * Typesense در حالت full و موتور درون‌حافظه در حالت lite.
 */
export interface SearchEngine {
  readonly kind: 'memory' | 'typesense';
  /** ساخت collection/alias اگر وجود ندارد (idempotent) */
  ensureReady(): Promise<void>;
  /** آیا ایندکس آگهی خالی است؟ (برای ساخت اولیه) */
  isEmpty(): Promise<boolean>;
  search(query: EngineSearchQuery): Promise<EngineSearchResult>;
  getByIds(ids: string[]): Promise<ListingDoc[]>;
  /** شمارش آگهی‌ها در سلول‌های geohash برای خوشه‌بندی نقشه */
  geoCells(query: ScopeQuery, precision: 3 | 4 | 5 | 6): Promise<GeoCellsResult>;
  /** پین‌ها: همه‌ی آگهی‌های محدوده، یا فقط آگهی‌های سلول‌های داده‌شده */
  pins(
    query: ScopeQuery,
    options: { limit: number; cells?: { precision: 3 | 4 | 5 | 6; hashes: string[] } },
  ): Promise<{ pins: MapPin[]; found: number }>;
  suggest(text: string, limit: number): Promise<SuggestDoc[]>;

  upsertListings(docs: ListingDoc[]): Promise<void>;
  removeListings(ids: string[]): Promise<void>;
  /** جایگزینی کامل پیشنهادها (تعداد آگهی‌ها عوض شده؛ ارزان است) */
  replaceSuggestions(docs: SuggestDoc[]): Promise<void>;
  beginReindex(): Promise<ReindexSession>;

  stats(): Promise<EngineStats>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export type { SearchCard };
