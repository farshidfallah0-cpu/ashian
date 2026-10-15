import type { FacetOption, SearchFacets } from '@ashian/shared';

export const FACET_LIMITS = { community: 50, amenities: 60 } as const;

export function emptyFacets(): SearchFacets {
  return {
    dealType: [],
    propertyType: [],
    bedrooms: [],
    furnishing: [],
    community: [],
    amenities: [],
    cheques: [],
    verified: { verified: 0, total: 0 },
    price: null,
    priceHistogram: null,
    areaSqft: null,
  };
}

/** شمارنده → گزینه‌ها: پرتعدادترین اول، یا به‌ترتیب عددی (تعداد خواب، تعداد چک) */
export function toOptions(
  counts: Iterable<[string, number]>,
  order: 'count' | 'numeric' = 'count',
  limit = 100,
): FacetOption[] {
  const options = [...counts]
    .filter(([, count]) => count > 0)
    .map(([value, count]) => ({ value, count }));
  options.sort(
    order === 'numeric'
      ? (a, b) => Number(a.value) - Number(b.value)
      : (a, b) => b.count - a.count || a.value.localeCompare(b.value),
  );
  return options.slice(0, limit);
}

export const HISTOGRAM_BUCKETS = 24;

/** لبه‌های لگاریتمی بین کمینه و بیشینه؛ قیمت ملک توزیع دم‌بلند دارد و لبه‌های مساوی هیستوگرام را تخت می‌کرد */
export function histogramEdges(min: number, max: number, buckets = HISTOGRAM_BUCKETS): number[] {
  const lo = Math.max(1, min);
  if (max <= lo) return [lo, lo + 1];
  const ratio = Math.log(max / lo);
  const edges = Array.from({ length: buckets + 1 }, (_, i) =>
    Math.round(lo * Math.exp((ratio * i) / buckets)),
  );
  edges[0] = lo;
  edges[buckets] = max + 1; // بیشینه داخل آخرین بازه‌ی [a, b) بیفتد
  return edges;
}

export function bucketCounts(values: Iterable<number>, edges: number[]): number[] {
  const counts = new Array<number>(edges.length - 1).fill(0);
  for (const v of values) {
    let index = edges.findIndex(
      (edge, i) => i < edges.length - 1 && v >= edge && v < edges[i + 1]!,
    );
    if (index < 0) index = v < edges[0]! ? 0 : counts.length - 1;
    counts[index]!++;
  }
  return counts;
}
