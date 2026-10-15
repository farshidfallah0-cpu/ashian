import type { Cache } from '@ashian/infra';
import {
  normalizeForSearch,
  serializeSearchQuery,
  toEnglishDigits,
  type MapCluster,
  type MapPin,
  type MapQuery,
  type MapResponse,
  type SearchFilters,
  type SearchHit,
  type SearchQuery,
  type SearchResponse,
  type SearchSort,
  type SuggestItem,
  type SuggestResponse,
} from '@ashian/shared';
import { parseCard } from './document.js';
import { decodeGeohash, precisionForZoom } from './geohash.js';
import { arrangePage, composePage } from './ranking.js';
import type { ListingDoc, ScopeQuery, SearchEngine, SuggestDoc } from './types.js';

/** پنجره‌ی نتایج برای چینش؛ دورتر از این، صفحه‌ها بدون ویژه و بدون شبیه‌سازی مرز می‌آیند */
export const ORGANIC_WINDOW = 250;
const FEATURED_POOL = 30;
/** تا این تعداد آگهی در محدوده، همه‌ی پین‌ها تکی نمایش داده می‌شوند */
const PIN_LIMIT = 150;
const MAX_PINS = 250;

const RESULT_TTL_SECONDS = 15;
const SUGGEST_TTL_SECONDS = 60;
const HOUR = 3_600;

export interface SearchServiceOptions {
  engine: SearchEngine;
  cache: Cache;
  /** unix ثانیه؛ برای تست قابل‌تزریق */
  now?: () => number;
}

/** عدد خالص ۴ تا ۸ رقمی = کد آگهی */
const CODE_PATTERN = /^\d{4,8}$/;

export class SearchService {
  private readonly engine: SearchEngine;
  private readonly cache: Cache;
  private readonly clock: () => number;

  constructor(options: SearchServiceOptions) {
    this.engine = options.engine;
    this.cache = options.cache;
    this.clock = options.now ?? (() => Math.floor(Date.now() / 1000));
  }

  /** متن کاربر → کد آگهی یا متن یکسان‌شده. هر ورودی قبل از رسیدن به موتور اینجا عبور می‌کند. */
  private parseText(raw: string | undefined): { text: string; code?: number } {
    if (!raw) return { text: '' };
    const compact = toEnglishDigits(raw).replace(/\s+/g, '');
    if (CODE_PATTERN.test(compact)) return { text: '', code: Number(compact) };
    return { text: normalizeForSearch(raw) };
  }

  private scope(
    filters: SearchFilters,
    extra: { bbox?: SearchQuery['bbox'] },
    now: number,
  ): ScopeQuery {
    return { filters, ...this.parseText(filters.q), bbox: extra.bbox, now };
  }

  /* ───────────── فهرست نتایج ───────────── */

  searchListings(query: SearchQuery): Promise<SearchResponse> {
    const now = this.clock();
    // seed ساعتی چرخش ویژه‌ها را در یک ساعت پایدار نگه می‌دارد؛ کلید کش هم همان را دارد
    const seed = Math.floor(now / HOUR);
    const key = `search:${seed}:${serializeSearchQuery(query)}`;
    return this.cache.wrap(key, RESULT_TTL_SECONDS, () => this.runSearch(query, now, seed));
  }

  private async runSearch(query: SearchQuery, now: number, seed: number): Promise<SearchResponse> {
    const started = performance.now();
    const scope = this.scope(query, { bbox: query.bbox }, now);
    const { page, pageSize } = query;
    const sorting = { sort: query.sort, verifiedFirst: query.verifiedFirst };
    const insideWindow = page * pageSize <= ORGANIC_WINDOW;

    // مرحله‌ی ۱: فهرست سبک (id + مشاور) و استخر ویژه‌ها، هم‌زمان
    const [organic, pool] = await Promise.all([
      this.engine.search({
        ...scope,
        ...sorting,
        offset: insideWindow ? 0 : (page - 1) * pageSize,
        limit: insideWindow ? ORGANIC_WINDOW : pageSize,
        fields: 'light',
        facets: query.facets,
      }),
      insideWindow
        ? this.engine.search({
            ...scope,
            tier: 'featured',
            sort: 'relevance',
            verifiedFirst: false,
            offset: 0,
            limit: FEATURED_POOL,
            fields: 'light',
          })
        : Promise.resolve({ found: 0, hits: [], tookMs: 0 }),
    ]);

    const total = organic.found;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const beyondEnd = page > totalPages;

    let placed: Array<{ id: string; featured: boolean }> = [];
    if (!beyondEnd) {
      if (insideWindow) {
        placed = composePage({
          organic: organic.hits,
          featuredPool: pool.hits,
          page,
          pageSize,
          seed,
        }).map(({ item, featured }) => ({ id: item.id, featured }));
      } else {
        // صفحه‌ی دور: بدون ویژه؛ فقط قانون پشت‌سرهم داخل خود صفحه
        placed = arrangePage(organic.hits, []).map((hit) => ({ id: hit.id, featured: false }));
      }
    }

    // مرحله‌ی ۲: کارت کامل فقط برای آگهی‌های همین صفحه
    const docs = await this.engine.getByIds(placed.map((p) => p.id));
    const byId = new Map<string, ListingDoc>(docs.map((d) => [d.id, d]));
    const items: SearchHit[] = placed.flatMap(({ id, featured }) => {
      const doc = byId.get(id);
      // آگهی بین دو مرحله از ایندکس رفته (حذف یا انقضا)؛ ساده رد می‌شود
      return doc ? [{ ...parseCard(doc), placement: featured ? 'featured' : 'organic' }] : [];
    });

    return {
      items,
      page,
      pageSize,
      total,
      totalPages,
      facets: organic.facets ?? null,
      tookMs: Math.round(performance.now() - started),
    };
  }

  /* ───────────── برش‌های ویترینی (صفحه‌ی اصلی) ───────────── */

  /** فقط facet (شمارش گزینه‌ها) برای یک فیلتر؛ بدون آگهی */
  async facetsFor(filters: SearchFilters): Promise<SearchResponse['facets']> {
    const now = this.clock();
    const result = await this.engine.search({
      ...this.scope(filters, {}, now),
      sort: 'newest',
      verifiedFirst: false,
      offset: 0,
      limit: 0,
      fields: 'light',
      facets: true,
    });
    return result.facets ?? null;
  }

  /**
   * تازه‌ترین آگهی‌ها بدون جایگاه ویژه (ویترین، نه نتایج جستجو).
   * قانون «حداکثر ۲ آگهی پشت‌سرهم از یک مشاور» اینجا هم رعایت می‌شود.
   */
  async latest(options: {
    verified?: boolean;
    dealType?: SearchFilters['dealType'];
    /** پیش‌فرض تازه‌ترین؛ «relevance» = بالاترین امتیاز کیفیت و تازگی */
    sort?: SearchSort;
    limit: number;
  }): Promise<SearchHit[]> {
    const now = this.clock();
    const filters = { verified: options.verified, dealType: options.dealType } as SearchFilters;
    const result = await this.engine.search({
      ...this.scope(filters, {}, now),
      sort: options.sort ?? 'newest',
      verifiedFirst: false,
      offset: 0,
      limit: Math.min(options.limit * 3, 60),
      fields: 'full',
    });
    const docs = new Map(result.hits.flatMap((h) => (h.doc ? [[h.id, h.doc] as const] : [])));
    return arrangePage(result.hits, [])
      .slice(0, options.limit)
      .flatMap((hit) => {
        const doc = docs.get(hit.id);
        return doc ? [{ ...parseCard(doc), placement: 'organic' as const }] : [];
      });
  }

  /* ───────────── نقشه ───────────── */

  async map(query: MapQuery): Promise<MapResponse> {
    const now = this.clock();
    const scope = this.scope(query, { bbox: query.bbox }, now);
    const precision = precisionForZoom(query.zoom);

    // زوم نزدیک یا محدوده‌ی کم‌آگهی: همه تکی
    const cells = await this.engine.geoCells(scope, precision);
    if (cells.found <= PIN_LIMIT || query.zoom >= 15) {
      const { pins, found } = await this.engine.pins(scope, { limit: MAX_PINS });
      return { total: found, clusters: [], pins, truncated: found > pins.length };
    }

    const singles = cells.cells.filter((c) => c.count === 1).map((c) => c.hash);
    const clusters: MapCluster[] = cells.cells
      .filter((c) => c.count > 1)
      .map((c) => ({ ...decodeGeohash(c.hash), count: c.count }));

    let pins: MapPin[] = [];
    if (singles.length > 0) {
      const wanted = singles.slice(0, MAX_PINS);
      pins = (
        await this.engine.pins(scope, {
          limit: MAX_PINS,
          cells: { precision, hashes: wanted },
        })
      ).pins;
    }
    return {
      total: cells.found,
      clusters,
      pins,
      truncated: cells.truncated || singles.length > MAX_PINS,
    };
  }

  /* ───────────── پیشنهاد خودکار ───────────── */

  async suggest(raw: string, limit: number): Promise<SuggestResponse> {
    const started = performance.now();
    const { text, code } = this.parseText(raw);
    if (!text && code === undefined) return { items: [], tookMs: 0 };

    const key = `suggest:${limit}:${code ?? text}`;
    const items = await this.cache.wrap<SuggestItem[]>(key, SUGGEST_TTL_SECONDS, async () => {
      if (code !== undefined) return this.suggestByCode(code);
      const docs = await this.engine.suggest(text, limit);
      return docs.map(toSuggestItem);
    });
    return { items, tookMs: Math.round(performance.now() - started) };
  }

  private async suggestByCode(code: number): Promise<SuggestItem[]> {
    const result = await this.engine.search({
      filters: {} as SearchFilters,
      text: '',
      code,
      now: this.clock(),
      sort: 'newest',
      verifiedFirst: false,
      offset: 0,
      limit: 3,
      fields: 'full',
    });
    return result.hits.flatMap((hit) => {
      if (!hit.doc) return [];
      const card = parseCard(hit.doc);
      return [
        {
          kind: 'listing' as const,
          ref: card.publicId,
          label: card.title,
          sublabel: `کد ${card.code}`,
          listingCount: 1,
        },
      ];
    });
  }
}

function toSuggestItem(doc: SuggestDoc): SuggestItem {
  return {
    kind: doc.kind,
    ref: doc.ref,
    label: doc.label,
    sublabel: doc.sublabel || null,
    listingCount: doc.listingCount,
  };
}
