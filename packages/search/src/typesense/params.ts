import type { SearchFacets, SearchSort } from '@ashian/shared';
import { FACET_LIMITS, emptyFacets, toOptions } from '../facets.js';
import {
  type FACET_GROUPS,
  groupHasActiveFilter,
  ignoreOf,
  toTypesenseFilter,
} from '../filters.js';
import type { EngineSearchQuery, ScopeQuery } from '../types.js';

/** ساخت پارامترهای پرس‌وجو و خواندن پاسخ؛ بدون I/O تا بدون سرور تست شود */

export const QUERY_BY = 'searchPlace,searchTitle,searchAgent,searchExtra';
export const QUERY_BY_WEIGHTS = '5,3,2,1';

const SORT_FIELDS: Record<SearchSort, string> = {
  relevance: 'rankScore:desc,publishedAt:desc',
  newest: 'publishedAt:desc,rankScore:desc',
  price_asc: 'price:asc,rankScore:desc',
  price_desc: 'price:desc,rankScore:desc',
  area_desc: 'areaSqft:desc,rankScore:desc',
};

/** Typesense حداکثر ۳ فیلد مرتب‌سازی می‌پذیرد */
export function buildSortBy(sort: SearchSort, verifiedFirst: boolean, hasText: boolean): string {
  const parts: string[] = [];
  if (verifiedFirst) parts.push('verified:desc');
  if (sort === 'relevance' && hasText) parts.push('_text_match(buckets: 5):desc');
  parts.push(...SORT_FIELDS[sort].split(','));
  return parts.slice(0, 3).join(',');
}

export type SearchParams = Record<string, string | number | boolean>;

export function textParams(text: string): SearchParams {
  return {
    q: text || '*',
    query_by: QUERY_BY,
    query_by_weights: QUERY_BY_WEIGHTS,
    prefix: true,
    num_typos: 2,
    min_len_1typo: 4,
    min_len_2typo: 8,
    // اگر همه‌ی واژه‌ها با هم نتیجه ندادند، واژه‌های آخر را رها کن
    drop_tokens_threshold: 1,
    typo_tokens_threshold: 1,
  };
}

/** فیلدهای هر گروه facet که با facet_by گرفته می‌شود (قیمت و متراژ جدا با min/max حساب می‌شوند) */
export const FACET_FIELDS = {
  dealType: 'dealType',
  propertyType: 'propertyType',
  bedrooms: 'bedrooms',
  furnishing: 'furnishing',
  community: 'communitySlug',
  amenities: 'amenities',
  cheques: 'rentCheques',
  verified: 'verified',
} as const;

export type CountedGroup = keyof typeof FACET_FIELDS;
export const COUNTED_GROUPS = Object.keys(FACET_FIELDS) as CountedGroup[];

export interface SearchPlan {
  /** پرس‌وجوی اصلی (نتایج + facet گروه‌های بدون فیلتر فعال) */
  main: SearchParams;
  /** پرس‌وجوهای کمکی facet و بازه‌ی قیمت/متراژ؛ کلید = نقش پاسخ */
  extras: Array<{ role: ExtraRole; params: SearchParams }>;
  /** گروه‌هایی که شمارششان از پرس‌وجوی اصلی می‌آید */
  inMain: CountedGroup[];
}

export type ExtraRole =
  | { kind: 'facet'; group: CountedGroup }
  | { kind: 'range'; field: 'price' | 'areaSqft'; edge: 'min' | 'max' };

export function buildSearchPlan(query: EngineSearchQuery): SearchPlan {
  const hasText = query.text.length > 0;
  const base = (scope: ScopeQuery, ignoreGroup?: keyof typeof FACET_GROUPS): SearchParams => ({
    ...textParams(scope.text),
    filter_by: toTypesenseFilter(scope, ignoreGroup ? ignoreOf(ignoreGroup) : undefined),
  });

  const main: SearchParams = {
    ...base(query),
    sort_by: buildSortBy(query.sort, query.verifiedFirst, hasText),
    ...(query.limit === 0 ? { per_page: 0 } : { offset: query.offset, limit: query.limit }),
    ...(query.fields === 'light' ? { include_fields: 'id,agentId' } : {}),
  };

  const inMain: CountedGroup[] = [];
  const extras: SearchPlan['extras'] = [];

  if (query.facets) {
    for (const group of COUNTED_GROUPS) {
      if (!groupHasActiveFilter(query.filters, group)) {
        inMain.push(group);
        continue;
      }
      extras.push({
        role: { kind: 'facet', group },
        params: {
          ...base(query, group),
          per_page: 0,
          facet_by: FACET_FIELDS[group],
          max_facet_values: FACET_LIMITS.amenities,
        },
      });
    }
    if (inMain.length) {
      main.facet_by = inMain.map((g) => FACET_FIELDS[g]).join(',');
      main.max_facet_values = FACET_LIMITS.amenities;
    }

    for (const [group, field] of [
      ['price', 'price'],
      ['area', 'areaSqft'],
    ] as const) {
      for (const edge of ['min', 'max'] as const) {
        extras.push({
          role: { kind: 'range', field, edge },
          params: {
            ...base(query, group),
            sort_by: `${field}:${edge === 'min' ? 'asc' : 'desc'}`,
            per_page: 1,
            include_fields: field,
          },
        });
      }
    }
  }
  return { main, extras, inMain };
}

/* ───────────── خواندن پاسخ ───────────── */

export interface RawFacetCount {
  field_name: string;
  counts: Array<{ value: string; count: number }>;
}

const fieldToGroup = new Map<string, CountedGroup>(
  (Object.entries(FACET_FIELDS) as Array<[CountedGroup, string]>).map(([g, f]) => [f, g]),
);

export function applyFacetCounts(facets: SearchFacets, raw: RawFacetCount[] | undefined) {
  for (const { field_name, counts } of raw ?? []) {
    const group = fieldToGroup.get(field_name);
    if (!group) continue;
    const entries = counts.map((c): [string, number] => [String(c.value), c.count]);
    switch (group) {
      case 'dealType':
      case 'propertyType':
      case 'furnishing':
        facets[group] = toOptions(entries);
        break;
      case 'bedrooms':
        facets.bedrooms = toOptions(entries, 'numeric');
        break;
      case 'cheques':
        facets.cheques = toOptions(entries, 'numeric');
        break;
      case 'community':
        facets.community = toOptions(entries, 'count', FACET_LIMITS.community);
        break;
      case 'amenities':
        facets.amenities = toOptions(entries, 'count', FACET_LIMITS.amenities);
        break;
      case 'verified': {
        const verified = counts.find((c) => String(c.value) === '1')?.count ?? 0;
        facets.verified = { verified, total: counts.reduce((sum, c) => sum + c.count, 0) };
        break;
      }
    }
  }
}

export { emptyFacets };
