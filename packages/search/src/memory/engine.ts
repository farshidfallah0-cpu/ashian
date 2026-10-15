import type { MapPin, SearchFacets, SearchSort } from '@ashian/shared';
import { bucketCounts, emptyFacets, FACET_LIMITS, histogramEdges, toOptions } from '../facets.js';
import { docMatches, ignoreOf, type FacetGroup, type FilterKey } from '../filters.js';
import type {
  EngineHit,
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
import { scoreTokens, tokenize } from './text-match.js';

const MAX_GEO_CELLS = 500;

interface Indexed {
  doc: ListingDoc;
  fields: Array<{ weight: number; tokens: string[] }>;
}

interface Store {
  listings: Map<string, Indexed>;
  suggestions: SuggestDoc[];
}

const KIND_WEIGHT: Record<SuggestDoc['kind'], number> = {
  community: 4,
  tower: 3,
  agency: 2,
  agent: 1,
  listing: 0,
};

function index(doc: ListingDoc): Indexed {
  return {
    doc,
    fields: [
      { weight: 5, tokens: tokenize(doc.searchPlace) },
      { weight: 3, tokens: tokenize(doc.searchTitle) },
      { weight: 2, tokens: tokenize(doc.searchAgent) },
      { weight: 1, tokens: tokenize(doc.searchExtra) },
    ],
  };
}

function comparator(
  sort: SearchSort,
  verifiedFirst: boolean,
  scores: ReadonlyMap<string, number> | null,
): (a: ListingDoc, b: ListingDoc) => number {
  const secondary = (a: ListingDoc, b: ListingDoc): number => {
    switch (sort) {
      case 'newest':
        return b.publishedAt - a.publishedAt || b.rankScore - a.rankScore;
      case 'price_asc':
        return a.price - b.price || b.rankScore - a.rankScore;
      case 'price_desc':
        return b.price - a.price || b.rankScore - a.rankScore;
      case 'area_desc':
        return b.areaSqft - a.areaSqft || b.rankScore - a.rankScore;
      default:
        return (
          (scores ? (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) : 0) ||
          b.rankScore - a.rankScore ||
          b.publishedAt - a.publishedAt
        );
    }
  };
  return (a, b) =>
    (verifiedFirst ? b.verified - a.verified : 0) || secondary(a, b) || a.id.localeCompare(b.id);
}

/**
 * موتور جستجوی درون‌حافظه (INFRA_MODE=lite). همان قرارداد Typesense را با اسکن خطی پیاده می‌کند؛
 * برای چند هزار آگهی در توسعه کافی است ولی هدف کارایی production نیست.
 * ایندکس در حافظه‌ی همین پروسه است، پس در حالت lite باید در همان پروسه‌ای که می‌خواند به‌روز شود
 * (API خودش مصرف‌کننده‌ی صف search است).
 */
export class MemoryEngine implements SearchEngine {
  readonly kind = 'memory' as const;
  private store: Store = { listings: new Map(), suggestions: [] };

  async ensureReady(): Promise<void> {}

  async isEmpty(): Promise<boolean> {
    return this.store.listings.size === 0;
  }

  /** امتیاز متنی هر سند؛ null = پرس‌وجوی متنی نیست. اگر هیچ سندی کامل نخورد، یک واژه کمتر را می‌پذیرد. */
  private textScores(text: string): Map<string, number> | null {
    const tokens = tokenize(text);
    if (tokens.length === 0) return null;
    const run = (minMatched: number) => {
      const scores = new Map<string, number>();
      for (const [id, entry] of this.store.listings) {
        const score = scoreTokens(tokens, entry.fields, minMatched);
        if (score > 0) scores.set(id, score);
      }
      return scores;
    };
    const exact = run(tokens.length);
    if (exact.size > 0 || tokens.length < 2) return exact;
    return run(tokens.length - 1);
  }

  private matching(
    scope: ScopeQuery,
    scores: ReadonlyMap<string, number> | null,
    ignore?: ReadonlySet<FilterKey>,
  ): ListingDoc[] {
    const out: ListingDoc[] = [];
    for (const [id, { doc }] of this.store.listings) {
      if (scores && !scores.has(id)) continue;
      if (docMatches(doc, scope, ignore)) out.push(doc);
    }
    return out;
  }

  async search(query: EngineSearchQuery): Promise<EngineSearchResult> {
    const started = performance.now();
    const scores = this.textScores(query.text);
    const matched = this.matching(query, scores);
    matched.sort(comparator(query.sort, query.verifiedFirst, scores));

    const page = matched.slice(query.offset, query.offset + query.limit);
    const hits: EngineHit[] = page.map((doc) => ({
      id: doc.id,
      agentId: doc.agentId,
      ...(query.fields === 'full' ? { doc } : {}),
    }));
    return {
      found: matched.length,
      hits,
      facets: query.facets ? this.facets(query, scores, matched.length) : undefined,
      tookMs: Math.round(performance.now() - started),
    };
  }

  private facets(
    query: ScopeQuery,
    scores: ReadonlyMap<string, number> | null,
    mainCount: number,
  ): SearchFacets {
    const facets = emptyFacets();
    const docsFor = (group: FacetGroup): ListingDoc[] =>
      this.matching(query, scores, ignoreOf(group));

    const tally = (group: FacetGroup, pick: (doc: ListingDoc) => string[]) => {
      const counts = new Map<string, number>();
      for (const doc of docsFor(group)) {
        for (const value of pick(doc)) counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return counts;
    };

    facets.dealType = toOptions(tally('dealType', (d) => [d.dealType]));
    facets.propertyType = toOptions(tally('propertyType', (d) => [d.propertyType]));
    facets.bedrooms = toOptions(
      tally('bedrooms', (d) => [String(d.bedrooms)]),
      'numeric',
    );
    facets.furnishing = toOptions(tally('furnishing', (d) => [d.furnishing]));
    facets.community = toOptions(
      tally('community', (d) => [d.communitySlug]),
      'count',
      FACET_LIMITS.community,
    );
    facets.amenities = toOptions(
      tally('amenities', (d) => d.amenities),
      'count',
      FACET_LIMITS.amenities,
    );
    facets.cheques = toOptions(
      tally('cheques', (d) => d.rentCheques.map(String)),
      'numeric',
    );

    const verifiedDocs = docsFor('verified');
    facets.verified = {
      verified: verifiedDocs.filter((d) => d.verified === 1).length,
      total: query.filters.verified ? verifiedDocs.length : mainCount,
    };

    const range = (docs: ListingDoc[], pick: (d: ListingDoc) => number) => {
      if (docs.length === 0) return null;
      let min = Infinity;
      let max = -Infinity;
      for (const doc of docs) {
        const v = pick(doc);
        if (v < min) min = v;
        if (v > max) max = v;
      }
      return { min, max };
    };
    const priceDocs = docsFor('price');
    facets.price = range(priceDocs, (d) => d.price);
    if (facets.price) {
      const edges = histogramEdges(facets.price.min, facets.price.max);
      facets.priceHistogram = {
        edges,
        counts: bucketCounts(
          priceDocs.map((d) => d.price),
          edges,
        ),
      };
    }
    facets.areaSqft = range(docsFor('area'), (d) => d.areaSqft);
    return facets;
  }

  async getByIds(ids: string[]): Promise<ListingDoc[]> {
    return ids.flatMap((id) => {
      const entry = this.store.listings.get(id);
      return entry ? [entry.doc] : [];
    });
  }

  async geoCells(query: ScopeQuery, precision: 3 | 4 | 5 | 6): Promise<GeoCellsResult> {
    const docs = this.matching(query, this.textScores(query.text));
    const counts = new Map<string, number>();
    const key = `geohash${precision}` as const;
    for (const doc of docs) counts.set(doc[key], (counts.get(doc[key]) ?? 0) + 1);
    const cells = [...counts].map(([hash, count]) => ({ hash, count }));
    cells.sort((a, b) => b.count - a.count || a.hash.localeCompare(b.hash));
    return {
      found: docs.length,
      cells: cells.slice(0, MAX_GEO_CELLS),
      truncated: cells.length > MAX_GEO_CELLS,
    };
  }

  async pins(
    query: ScopeQuery,
    options: { limit: number; cells?: { precision: 3 | 4 | 5 | 6; hashes: string[] } },
  ): Promise<{ pins: MapPin[]; found: number }> {
    let docs = this.matching(query, this.textScores(query.text));
    if (options.cells) {
      const key = `geohash${options.cells.precision}` as const;
      const wanted = new Set(options.cells.hashes);
      docs = docs.filter((d) => wanted.has(d[key]));
    }
    docs.sort((a, b) => b.rankScore - a.rankScore || a.id.localeCompare(b.id));
    return {
      found: docs.length,
      pins: docs.slice(0, options.limit).map((d): MapPin => ({
        publicId: d.id,
        lng: d.location[1],
        lat: d.location[0],
        price: d.price,
        dealType: d.dealType as MapPin['dealType'],
        propertyType: d.propertyType as MapPin['propertyType'],
        isVerified: d.verified === 1,
        tier: d.tier,
      })),
    };
  }

  async suggest(text: string, limit: number): Promise<SuggestDoc[]> {
    const tokens = tokenize(text);
    if (tokens.length === 0) return [];
    const scored: Array<{ doc: SuggestDoc; score: number }> = [];
    for (const doc of this.store.suggestions) {
      const score = scoreTokens(tokens, [{ weight: 1, tokens: tokenize(doc.searchText) }]);
      if (score > 0) scored.push({ doc, score: score * 10 + KIND_WEIGHT[doc.kind] });
    }
    scored.sort((a, b) => b.score - a.score || b.doc.listingCount - a.doc.listingCount);
    return scored.slice(0, limit).map((s) => s.doc);
  }

  async upsertListings(docs: ListingDoc[]): Promise<void> {
    for (const doc of docs) this.store.listings.set(doc.id, index(doc));
  }

  async removeListings(ids: string[]): Promise<void> {
    for (const id of ids) this.store.listings.delete(id);
  }

  async replaceSuggestions(docs: SuggestDoc[]): Promise<void> {
    this.store.suggestions = docs;
  }

  async beginReindex(): Promise<ReindexSession> {
    const next: Store = { listings: new Map(), suggestions: [] };
    return {
      addListings: async (docs) => {
        for (const doc of docs) next.listings.set(doc.id, index(doc));
      },
      addSuggestions: async (docs) => {
        next.suggestions.push(...docs);
      },
      commit: async () => {
        this.store = next;
      },
      abort: async () => {},
    };
  }

  async stats(): Promise<EngineStats> {
    return {
      kind: 'memory',
      listings: this.store.listings.size,
      suggestions: this.store.suggestions.length,
      ready: true,
    };
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {}
}
