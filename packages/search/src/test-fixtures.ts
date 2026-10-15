import { buildListingDoc, type ListingSource } from './document.js';
import type { ListingDoc } from './types.js';

/** داده‌ی آزمایشی مشترک تست‌ها (در بسته‌ی نهایی export نمی‌شود) */
export const NOW = 1_800_000_000;
const DAY = 86_400;

const MARINA = {
  slug: 'dubai-marina',
  nameFa: 'دبی مارینا',
  nameEn: 'Dubai Marina',
  aliases: ['مارینا', 'DM'],
};
const JVC = {
  slug: 'jumeirah-village-circle',
  nameFa: 'جمیرا ویلج سیرکل',
  nameEn: 'Jumeirah Village Circle',
  aliases: ['JVC'],
};

export function makeSource(overrides: Partial<ListingSource> = {}, i = 0): ListingSource {
  const inMarina = i % 2 === 0;
  const community = inMarina ? MARINA : JVC;
  return {
    publicId: `L${String(i).padStart(9, '0')}`,
    code: 10_000 + i,
    dealType: 'rent',
    propertyType: 'apartment',
    furnishing: 'unfurnished',
    tier: 'standard',
    isVerified: false,
    title: `آپارتمان ${i % 4} خوابه در ${community.nameFa}`,
    price: 80_000 + i * 1_000,
    pricePerSqft: 90,
    bedrooms: i % 4,
    bathrooms: 2,
    areaSqft: 700 + i * 10,
    parkingSpaces: 1,
    photoCount: 8,
    rentCheques: [1, 4],
    qualityScore: 80,
    publishedAt: new Date((NOW - i * DAY) * 1000),
    createdAt: new Date((NOW - i * DAY) * 1000),
    expiresAt: null,
    lng: inMarina ? 55.14 + i * 0.0001 : 55.21 + i * 0.0001,
    lat: inMarina ? 25.08 : 25.06,
    amenitySlugs: i % 3 === 0 ? ['pool', 'gym'] : ['gym'],
    place: { ...community, type: 'community', path: `dubai/${community.slug}` },
    community,
    emirate: { nameFa: 'دبی', nameEn: 'Dubai' },
    cover: null,
    photos: [],
    media: { video: false, tour360: false, floorplan: false },
    agent: {
      id: `agent-${i % 5}`,
      name: `مشاور ${i % 5}`,
      avatarKey: null,
      isVerified: true,
      isTopAgent: false,
      agencyName: 'آژانس نمونه',
    },
    ...overrides,
  };
}

export function makeDoc(overrides: Partial<ListingSource> = {}, i = 0): ListingDoc {
  return buildListingDoc(makeSource(overrides, i), NOW);
}

export function makeDocs(count: number, customize?: (i: number) => Partial<ListingSource>) {
  return Array.from({ length: count }, (_, i) => makeDoc(customize?.(i) ?? {}, i));
}
