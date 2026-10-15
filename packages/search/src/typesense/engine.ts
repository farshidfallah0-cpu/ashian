import type { MapPin } from '@ashian/shared';
import { histogramEdges } from '../facets.js';
import { ignoreOf, toTypesenseFilter } from '../filters.js';
import type {
  EngineSearchQuery,
  EngineSearchResult,
  EngineStats,
  GeoCellsResult,
  ListingDoc,
  ReindexSession,
  ScopeQuery,
  SearchEngine,
  SuggestDoc,
} from '../types.js';
import { isNotFound, type TypesenseClient, TypesenseError } from './client.js';
import {
  applyFacetCounts,
  buildSearchPlan,
  emptyFacets,
  textParams,
  type RawFacetCount,
  type SearchParams,
} from './params.js';
import {
  collectionName,
  LISTINGS_ALIAS,
  listingsSchema,
  SUGGESTIONS_ALIAS,
  suggestionsSchema,
  type CollectionSchema,
} from './schema.js';

const IMPORT_BATCH = 400;
const KIND_WEIGHT: Record<SuggestDoc['kind'], number> = {
  community: 4,
  tower: 3,
  agency: 2,
  agent: 1,
  listing: 0,
};

interface RawResult {
  found?: number;
  hits?: Array<{ document: Record<string, unknown> }>;
  facet_counts?: RawFacetCount[];
  search_time_ms?: number;
  code?: number;
  error?: string;
}

/** پاسخ‌های multi_search خطای هر پرس‌وجو را داخل خود نتیجه می‌گذارند */
function assertOk(result: RawResult | undefined): RawResult {
  if (!result) throw new Error('پاسخ خالی از Typesense');
  if (result.error) throw new TypesenseError(result.code ?? 500, result.error);
  return result;
}

const chunk = <T>(items: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) =>
    items.slice(i * size, (i + 1) * size),
  );

/**
 * آداپتور Typesense (INFRA_MODE=full).
 * ایندکس‌ها همیشه از طریق alias خوانده و نوشته می‌شوند؛ reindex ایندکس نسخه‌دار تازه می‌سازد
 * و alias را اتمیک جابه‌جا می‌کند، پس جستجو هیچ‌وقت قطع نمی‌شود.
 */
export class TypesenseEngine implements SearchEngine {
  readonly kind = 'typesense' as const;

  constructor(private readonly client: TypesenseClient) {}

  /* ───────────── مدیریت collection ───────────── */

  private async createCollection(schema: CollectionSchema) {
    await this.client.request('POST', '/collections', schema);
  }

  private async aliasTarget(alias: string): Promise<string | null> {
    try {
      const result = await this.client.request<{ collection_name: string }>(
        'GET',
        `/aliases/${alias}`,
      );
      return result.collection_name;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  private async pointAlias(alias: string, collection: string) {
    await this.client.request('PUT', `/aliases/${alias}`, { collection_name: collection });
  }

  async ensureReady(): Promise<void> {
    for (const [alias, make] of [
      [LISTINGS_ALIAS, listingsSchema],
      [SUGGESTIONS_ALIAS, suggestionsSchema],
    ] as const) {
      if (await this.aliasTarget(alias)) continue;
      const name = collectionName(alias, 'initial');
      try {
        await this.createCollection(make(name));
      } catch (error) {
        // دو پروسه هم‌زمان بالا آمده‌اند؛ دیگری ساخته است
        if (!(error instanceof TypesenseError && error.status === 409)) throw error;
      }
      await this.pointAlias(alias, name);
    }
  }

  async isEmpty(): Promise<boolean> {
    const target = await this.aliasTarget(LISTINGS_ALIAS);
    if (!target) return true;
    const info = await this.client.request<{ num_documents: number }>(
      'GET',
      `/collections/${target}`,
    );
    return info.num_documents === 0;
  }

  /* ───────────── جستجو ───────────── */

  private async multiSearch(
    searches: Array<{ collection: string; params: SearchParams }>,
  ): Promise<RawResult[]> {
    const response = await this.client.request<{ results: RawResult[] }>('POST', '/multi_search', {
      searches: searches.map((s) => ({ collection: s.collection, ...s.params })),
    });
    return response.results;
  }

  async search(query: EngineSearchQuery): Promise<EngineSearchResult> {
    const plan = buildSearchPlan(query);
    const results = await this.multiSearch([
      { collection: LISTINGS_ALIAS, params: plan.main },
      ...plan.extras.map((e) => ({ collection: LISTINGS_ALIAS, params: e.params })),
    ]);
    const main = assertOk(results[0]);

    const hits = (main.hits ?? []).map(({ document }) => ({
      id: String(document.id),
      agentId: typeof document.agentId === 'string' ? document.agentId : '',
      ...(query.fields === 'full' ? { doc: document as unknown as ListingDoc } : {}),
    }));

    let facets;
    if (query.facets) {
      facets = emptyFacets();
      applyFacetCounts(facets, main.facet_counts);
      const range = { price: { min: NaN, max: NaN }, areaSqft: { min: NaN, max: NaN } };
      for (const [i, extra] of plan.extras.entries()) {
        const result = assertOk(results[i + 1]);
        if (extra.role.kind === 'facet') {
          applyFacetCounts(facets, result.facet_counts);
        } else {
          const value = result.hits?.[0]?.document[extra.role.field];
          range[extra.role.field][extra.role.edge] = typeof value === 'number' ? value : NaN;
        }
      }
      const finite = (r: { min: number; max: number }) =>
        Number.isFinite(r.min) && Number.isFinite(r.max) ? r : null;
      facets.price = finite(range.price);
      if (facets.price) facets.priceHistogram = await this.priceHistogram(query, facets.price);
      facets.areaSqft = finite(range.areaSqft);
    }

    return {
      found: main.found ?? 0,
      hits,
      facets,
      tookMs: main.search_time_ms ?? 0,
    };
  }

  /**
   * هیستوگرام قیمت با facet بازه‌ای (لبه‌های لگاریتمی)؛ فیلتر قیمت نادیده گرفته می‌شود تا کاربر کل توزیع را ببیند.
   * فقط وقتی facet خواسته شده، یک پرس‌وجوی سبک (per_page=0) است.
   */
  private async priceHistogram(
    query: EngineSearchQuery,
    range: { min: number; max: number },
  ): Promise<{ edges: number[]; counts: number[] }> {
    const edges = histogramEdges(range.min, range.max);
    const buckets = edges.slice(0, -1).map((edge, i) => `b${i}:[${edge},${edges[i + 1]}]`);
    const [result] = await this.multiSearch([
      {
        collection: LISTINGS_ALIAS,
        params: {
          ...textParams(query.text),
          filter_by: toTypesenseFilter(query, ignoreOf('price')),
          per_page: 0,
          facet_by: `price(${buckets.join(', ')})`,
          max_facet_values: edges.length,
        },
      },
    ]);
    const counts = new Array<number>(edges.length - 1).fill(0);
    for (const c of assertOk(result).facet_counts?.[0]?.counts ?? []) {
      const index = Number(String(c.value).replace(/^b/, ''));
      if (index >= 0 && index < counts.length) counts[index] = c.count;
    }
    return { edges, counts };
  }

  async getByIds(ids: string[]): Promise<ListingDoc[]> {
    if (ids.length === 0) return [];
    const [result] = await this.multiSearch([
      {
        collection: LISTINGS_ALIAS,
        params: {
          q: '*',
          filter_by: `id:=[${ids.map((id) => `\`${id}\``).join(',')}]`,
          per_page: Math.min(ids.length, 250),
        },
      },
    ]);
    const byId = new Map(
      (assertOk(result).hits ?? []).map(({ document }) => [
        String(document.id),
        document as unknown as ListingDoc,
      ]),
    );
    // ترتیب ورودی حفظ می‌شود
    return ids.flatMap((id) => {
      const doc = byId.get(id);
      return doc ? [doc] : [];
    });
  }

  async geoCells(query: ScopeQuery, precision: 3 | 4 | 5 | 6): Promise<GeoCellsResult> {
    const maxCells = 500;
    const [result] = await this.multiSearch([
      {
        collection: LISTINGS_ALIAS,
        params: {
          ...textParams(query.text),
          filter_by: toTypesenseFilter(query),
          per_page: 0,
          facet_by: `geohash${precision}`,
          max_facet_values: maxCells,
        },
      },
    ]);
    const main = assertOk(result);
    const counts = main.facet_counts?.[0]?.counts ?? [];
    return {
      found: main.found ?? 0,
      cells: counts.map((c) => ({ hash: String(c.value), count: c.count })),
      truncated: counts.length >= maxCells,
    };
  }

  async pins(
    query: ScopeQuery,
    options: { limit: number; cells?: { precision: 3 | 4 | 5 | 6; hashes: string[] } },
  ): Promise<{ pins: MapPin[]; found: number }> {
    let filter = toTypesenseFilter(query);
    if (options.cells) {
      const hashes = options.cells.hashes.map((h) => `\`${h}\``).join(',');
      filter += ` && geohash${options.cells.precision}:=[${hashes}]`;
    }
    const [result] = await this.multiSearch([
      {
        collection: LISTINGS_ALIAS,
        params: {
          ...textParams(query.text),
          filter_by: filter,
          sort_by: 'rankScore:desc',
          per_page: Math.min(options.limit, 250),
          include_fields: 'id,location,price,dealType,propertyType,verified,tier',
        },
      },
    ]);
    const main = assertOk(result);
    return {
      found: main.found ?? 0,
      pins: (main.hits ?? []).map(({ document: d }): MapPin => {
        const [lat, lng] = d.location as [number, number];
        return {
          publicId: String(d.id),
          lng,
          lat,
          price: Number(d.price),
          dealType: d.dealType as MapPin['dealType'],
          propertyType: d.propertyType as MapPin['propertyType'],
          isVerified: d.verified === 1,
          tier: d.tier as MapPin['tier'],
        };
      }),
    };
  }

  async suggest(text: string, limit: number): Promise<SuggestDoc[]> {
    const [result] = await this.multiSearch([
      {
        collection: SUGGESTIONS_ALIAS,
        params: {
          q: text,
          query_by: 'searchText',
          prefix: true,
          num_typos: 1,
          min_len_1typo: 4,
          sort_by: '_text_match(buckets: 3):desc,kindWeight:desc,listingCount:desc',
          per_page: limit,
        },
      },
    ]);
    return (assertOk(result).hits ?? []).map(({ document: d }) => ({
      id: String(d.id),
      kind: d.kind as SuggestDoc['kind'],
      ref: String(d.ref),
      label: String(d.label),
      sublabel: typeof d.sublabel === 'string' ? d.sublabel : '',
      searchText: String(d.searchText),
      listingCount: Number(d.listingCount),
    }));
  }

  /* ───────────── نوشتن ───────────── */

  private async importDocs(collection: string, docs: object[]) {
    for (const batch of chunk(docs, IMPORT_BATCH)) {
      const body = batch.map((d) => JSON.stringify(d)).join('\n');
      const response = await this.client.request<string>(
        'POST',
        `/collections/${collection}/documents/import?action=upsert`,
        undefined,
        { rawBody: body, timeoutMs: 30_000 },
      );
      const failures = response
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { success: boolean; error?: string })
        .filter((r) => !r.success);
      if (failures.length) {
        throw new Error(
          `${failures.length} سند ایندکس نشد؛ نمونه: ${failures[0]?.error ?? 'نامشخص'}`,
        );
      }
    }
  }

  private suggestionPayload = (docs: SuggestDoc[]) =>
    docs.map((d) => ({ ...d, kindWeight: KIND_WEIGHT[d.kind] }));

  async upsertListings(docs: ListingDoc[]): Promise<void> {
    if (docs.length) await this.importDocs(LISTINGS_ALIAS, docs);
  }

  async removeListings(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    for (const batch of chunk(ids, 100)) {
      const filter = `id:=[${batch.map((id) => `\`${id}\``).join(',')}]`;
      await this.client.request(
        'DELETE',
        `/collections/${LISTINGS_ALIAS}/documents?filter_by=${encodeURIComponent(filter)}`,
      );
    }
  }

  async replaceSuggestions(docs: SuggestDoc[]): Promise<void> {
    const name = collectionName(SUGGESTIONS_ALIAS);
    await this.createCollection(suggestionsSchema(name));
    try {
      await this.importDocs(name, this.suggestionPayload(docs));
    } catch (error) {
      await this.client.request('DELETE', `/collections/${name}`);
      throw error;
    }
    const old = await this.aliasTarget(SUGGESTIONS_ALIAS);
    await this.pointAlias(SUGGESTIONS_ALIAS, name);
    if (old) await this.client.request('DELETE', `/collections/${old}`).catch(() => undefined);
  }

  async beginReindex(): Promise<ReindexSession> {
    const suffix = Date.now();
    const listings = collectionName(LISTINGS_ALIAS, suffix);
    const suggestions = collectionName(SUGGESTIONS_ALIAS, suffix);
    await this.createCollection(listingsSchema(listings));
    await this.createCollection(suggestionsSchema(suggestions));

    const drop = async (...names: Array<string | null>) => {
      for (const name of names) {
        if (!name) continue;
        try {
          await this.client.request('DELETE', `/collections/${name}`);
        } catch (error) {
          if (!isNotFound(error)) throw error;
        }
      }
    };

    return {
      addListings: (docs) => this.importDocs(listings, docs),
      addSuggestions: (docs) => this.importDocs(suggestions, this.suggestionPayload(docs)),
      commit: async () => {
        const [oldListings, oldSuggestions] = await Promise.all([
          this.aliasTarget(LISTINGS_ALIAS),
          this.aliasTarget(SUGGESTIONS_ALIAS),
        ]);
        await this.pointAlias(LISTINGS_ALIAS, listings);
        await this.pointAlias(SUGGESTIONS_ALIAS, suggestions);
        await drop(oldListings, oldSuggestions);
      },
      abort: () => drop(listings, suggestions),
    };
  }

  async stats(): Promise<EngineStats> {
    const count = async (alias: string) => {
      const target = await this.aliasTarget(alias);
      if (!target) return null;
      const info = await this.client.request<{ num_documents: number }>(
        'GET',
        `/collections/${target}`,
      );
      return info.num_documents;
    };
    const [listings, suggestions] = await Promise.all([
      count(LISTINGS_ALIAS),
      count(SUGGESTIONS_ALIAS),
    ]);
    return {
      kind: 'typesense',
      listings: listings ?? 0,
      suggestions: suggestions ?? 0,
      ready: listings !== null && suggestions !== null,
    };
  }

  ping(): Promise<boolean> {
    return this.client.health();
  }

  async close(): Promise<void> {}
}
