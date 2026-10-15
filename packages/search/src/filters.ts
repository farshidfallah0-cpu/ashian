import type { BoundingBox, SearchFilters } from '@ashian/shared';
import type { ListingDoc, ScopeQuery } from './types.js';

/**
 * معنای فیلترها یک‌بار اینجا تعریف می‌شود و دو موتور (Typesense و درون‌حافظه) از آن پیروی می‌کنند:
 * - `docMatches`: همان قاعده به‌صورت تابع، برای موتور درون‌حافظه و تست
 * - `toTypesenseFilter`: همان قاعده به‌صورت filter_by
 */

export type FilterKey = Exclude<keyof SearchFilters, 'q'>;

/**
 * facet شمارش‌دار «ناهم‌پیوند» (disjunctive): شمارش هر گروه، فیلتر خودش را نادیده می‌گیرد.
 * وگرنه با انتخاب «ویلا» تعداد بقیه‌ی نوع‌ها صفر می‌شد و کاربر نمی‌توانست جابه‌جا شود.
 */
export const FACET_GROUPS = {
  dealType: ['dealType'],
  propertyType: ['propertyType'],
  bedrooms: ['bedroomsMin', 'bedroomsMax'],
  furnishing: ['furnishing'],
  community: ['location'],
  amenities: ['amenities'],
  cheques: ['cheques'],
  verified: ['verified'],
  price: ['priceMin', 'priceMax'],
  area: ['areaMin', 'areaMax'],
} as const satisfies Record<string, readonly FilterKey[]>;

export type FacetGroup = keyof typeof FACET_GROUPS;

const NO_IGNORE: ReadonlySet<FilterKey> = new Set();

function inBox(doc: ListingDoc, box: BoundingBox): boolean {
  const [lat, lng] = doc.location;
  return lng >= box[0] && lat >= box[1] && lng <= box[2] && lat <= box[3];
}

/** آیا سند با فیلترها (به‌جز کلیدهای نادیده‌گرفته‌شده) می‌خواند؟ */
export function docMatches(
  doc: ListingDoc,
  scope: Pick<ScopeQuery, 'filters' | 'tier' | 'bbox' | 'now' | 'code'>,
  ignore: ReadonlySet<FilterKey> = NO_IGNORE,
): boolean {
  const f = scope.filters;
  const on = (key: FilterKey) => !ignore.has(key) && f[key] !== undefined;

  if (doc.expiresAt <= scope.now) return false;
  if (scope.tier && doc.tier !== scope.tier) return false;
  if (scope.code !== undefined && doc.code !== scope.code) return false;
  if (scope.bbox && !inBox(doc, scope.bbox)) return false;

  if (on('dealType') && !f.dealType!.includes(doc.dealType as never)) return false;
  if (on('propertyType') && !f.propertyType!.includes(doc.propertyType as never)) return false;
  if (on('furnishing') && !f.furnishing!.includes(doc.furnishing as never)) return false;
  if (on('location') && !f.location!.some((p) => doc.locationPaths.includes(p))) return false;
  if (on('amenities') && !f.amenities!.every((a) => doc.amenities.includes(a))) return false;

  if (on('priceMin') && doc.price < f.priceMin!) return false;
  if (on('priceMax') && doc.price > f.priceMax!) return false;
  if (on('bedroomsMin') && doc.bedrooms < f.bedroomsMin!) return false;
  if (on('bedroomsMax') && doc.bedrooms > f.bedroomsMax!) return false;
  if (on('bathroomsMin') && doc.bathrooms < f.bathroomsMin!) return false;
  if (on('areaMin') && doc.areaSqft < f.areaMin!) return false;
  if (on('areaMax') && doc.areaSqft > f.areaMax!) return false;
  if (on('parkingMin') && doc.parkingSpaces < f.parkingMin!) return false;

  if (on('verified') && f.verified && doc.verified !== 1) return false;
  if (on('agentId') && doc.agentId !== f.agentId) return false;
  if (on('cheques') && !doc.rentCheques.includes(f.cheques!)) return false;
  if (on('postedWithin') && doc.publishedAt < scope.now - f.postedWithin! * 86_400) return false;
  return true;
}

/** مقدار رشته‌ای در filter_by؛ backtick اجازه‌ی «/» و «-» را در مقدار می‌دهد */
const quote = (value: string) => `\`${value.replaceAll('`', '')}\``;
const anyOf = (field: string, values: readonly (string | number)[]) =>
  `${field}:=[${values.map((v) => (typeof v === 'number' ? v : quote(v))).join(',')}]`;

/**
 * همان فیلترها به‌صورت filter_by تایپ‌سنس.
 * bbox با چندضلعی (lat,lng) نوشته می‌شود؛ محدوده‌ی عبورکننده از ±۱۸۰ پشتیبانی نمی‌شود (بازار ما آن‌جا نیست).
 */
export function toTypesenseFilter(
  scope: Pick<ScopeQuery, 'filters' | 'tier' | 'bbox' | 'now' | 'code'>,
  ignore: ReadonlySet<FilterKey> = NO_IGNORE,
): string {
  const f = scope.filters;
  const on = (key: FilterKey) => !ignore.has(key) && f[key] !== undefined;
  const parts: string[] = [`expiresAt:>${scope.now}`];

  if (scope.tier) parts.push(`tier:=${scope.tier}`);
  if (scope.code !== undefined) parts.push(`code:=${scope.code}`);
  if (scope.bbox) {
    const [west, south, east, north] = scope.bbox;
    parts.push(
      `location:(${north}, ${west}, ${north}, ${east}, ${south}, ${east}, ${south}, ${west})`,
    );
  }

  if (on('dealType')) parts.push(anyOf('dealType', f.dealType!));
  if (on('propertyType')) parts.push(anyOf('propertyType', f.propertyType!));
  if (on('furnishing')) parts.push(anyOf('furnishing', f.furnishing!));
  if (on('location')) parts.push(anyOf('locationPaths', f.location!));
  if (on('amenities')) for (const slug of f.amenities!) parts.push(`amenities:=${quote(slug)}`);

  if (on('priceMin')) parts.push(`price:>=${f.priceMin}`);
  if (on('priceMax')) parts.push(`price:<=${f.priceMax}`);
  if (on('bedroomsMin')) parts.push(`bedrooms:>=${f.bedroomsMin}`);
  if (on('bedroomsMax')) parts.push(`bedrooms:<=${f.bedroomsMax}`);
  if (on('bathroomsMin')) parts.push(`bathrooms:>=${f.bathroomsMin}`);
  if (on('areaMin')) parts.push(`areaSqft:>=${f.areaMin}`);
  if (on('areaMax')) parts.push(`areaSqft:<=${f.areaMax}`);
  if (on('parkingMin')) parts.push(`parkingSpaces:>=${f.parkingMin}`);

  if (on('verified') && f.verified) parts.push('verified:=1');
  if (on('agentId')) parts.push(`agentId:=${quote(f.agentId!)}`);
  if (on('cheques')) parts.push(`rentCheques:=${f.cheques}`);
  if (on('postedWithin')) parts.push(`publishedAt:>=${scope.now - f.postedWithin! * 86_400}`);

  return parts.join(' && ');
}

/** کلیدهای فیلتر فعال هر گروه facet؛ برای تصمیم‌گیری درباره‌ی نیاز به پرس‌وجوی جدا */
export function groupHasActiveFilter(filters: SearchFilters, group: FacetGroup): boolean {
  return FACET_GROUPS[group].some((key) => {
    const value = filters[key as FilterKey];
    return value !== undefined && value !== false;
  });
}

export const ignoreOf = (group: FacetGroup): ReadonlySet<FilterKey> =>
  new Set<FilterKey>(FACET_GROUPS[group]);
