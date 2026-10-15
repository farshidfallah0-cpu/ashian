import type { PropertyType } from '@ashian/shared';

/**
 * صفحه‌های لندینگ سئو: /{deal}/{type?}/{beds?}/{community?}/{tower?}
 *   /rent/apartment/2-bedroom/dubai-marina   ← «اجاره‌ی آپارتمان دو خوابه در دبی مارینا»
 * مسیر کوتاه‌تر هم معتبر است (/rent/dubai-marina). ترتیب بخش‌ها ثابت است تا هر ترکیب فقط یک URL داشته باشد.
 */

export const DEAL_SLUGS = { rent: 'rent', sale: 'sale' } as const;
export type LandingDeal = keyof typeof DEAL_SLUGS;

export const TYPE_SLUGS: Record<PropertyType, string> = {
  apartment: 'apartment',
  villa: 'villa',
  townhouse: 'townhouse',
  penthouse: 'penthouse',
  duplex: 'duplex',
  hotel_apartment: 'hotel-apartment',
};
const TYPE_BY_SLUG = Object.fromEntries(
  Object.entries(TYPE_SLUGS).map(([type, slug]) => [slug, type]),
) as Record<string, PropertyType>;

export interface LandingPlace {
  type: 'emirate' | 'community' | 'tower';
  slug: string;
  path: string;
}

export interface LandingSpec {
  deal: LandingDeal;
  propertyType?: PropertyType;
  /** تعداد خواب دقیق؛ ۰ = استودیو */
  bedrooms?: number;
  /** مسیر مکان (محله یا برج) برای فیلتر location */
  location?: string;
}

const isDeal = (value: string): value is LandingDeal => value in DEAL_SLUGS;

const bedroomsSlug = (n: number) => (n === 0 ? 'studio' : `${n}-bedroom`);

function parseBedrooms(segment: string): number | null {
  if (segment === 'studio') return 0;
  const match = /^(\d{1,2})-bedroom$/.exec(segment);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 && n <= 12 ? n : null;
}

/** مسیر → مشخصات لندینگ؛ null یعنی ۴۰۴ */
export function parseLanding(
  deal: string,
  segments: readonly string[],
  places: readonly LandingPlace[],
): LandingSpec | null {
  if (!isDeal(deal)) return null;
  const spec: LandingSpec = { deal };
  const rest = [...segments];

  const type = rest[0] ? TYPE_BY_SLUG[rest[0]] : undefined;
  if (type) {
    spec.propertyType = type;
    rest.shift();
  }
  const beds = rest[0] !== undefined ? parseBedrooms(rest[0]) : null;
  if (beds !== null) {
    spec.bedrooms = beds;
    rest.shift();
  }
  if (rest.length > 0) {
    const community = places.find((p) => p.type === 'community' && p.slug === rest[0]);
    if (!community) return null;
    spec.location = community.path;
    rest.shift();
    if (rest.length > 0) {
      const tower = places.find(
        (p) => p.type === 'tower' && p.path === `${community.path}/${rest[0]}`,
      );
      if (!tower) return null;
      spec.location = tower.path;
      rest.shift();
    }
  }
  return rest.length === 0 ? spec : null;
}

/** مشخصات → مسیر یکتا (برای لینک‌های داخلی و canonical) */
export function landingPath(spec: LandingSpec): string {
  const parts: string[] = [spec.deal];
  if (spec.propertyType) parts.push(TYPE_SLUGS[spec.propertyType]);
  if (spec.bedrooms !== undefined) parts.push(bedroomsSlug(spec.bedrooms));
  if (spec.location) parts.push(...spec.location.split('/').slice(1));
  return `/${parts.join('/')}`;
}

/** فیلترهای ثابت لندینگ برای parseSearch */
export function landingPreset(spec: LandingSpec): Record<string, string> {
  const preset: Record<string, string> = { dealType: spec.deal };
  if (spec.propertyType) preset.propertyType = spec.propertyType;
  if (spec.bedrooms !== undefined) {
    preset.bedroomsMin = String(spec.bedrooms);
    preset.bedroomsMax = String(spec.bedrooms);
  }
  if (spec.location) preset.location = spec.location;
  return preset;
}
