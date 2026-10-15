import {
  LABELS,
  bedroomsLabel,
  normalizeForSearch,
  type DealType,
  type Furnishing,
  type ListingTier,
  type MediaVariants,
  type PropertyType,
  type SearchCard,
} from '@ashian/shared';
import { encodeGeohash } from './geohash.js';
import { computeRankScore } from './ranking.js';
import type { ListingDoc, SuggestDoc } from './types.js';

/** آگهی بدون تاریخ انقضا: سال ۲۱۰۰ */
export const NEVER_EXPIRES = 4_102_444_800;

const unix = (date: Date) => Math.floor(date.getTime() / 1000);

interface PlaceNames {
  slug: string;
  nameFa: string;
  nameEn: string;
  aliases: string[];
}

/** ورودی ساخت سند: داده‌ی خام آگهی با مکان و مشاور (مستقل از دیتابیس تا ساده تست شود) */
export interface ListingSource {
  publicId: string;
  code: number;
  dealType: DealType;
  propertyType: PropertyType;
  furnishing: Furnishing;
  tier: ListingTier;
  isVerified: boolean;
  title: string;
  price: number;
  pricePerSqft: number;
  bedrooms: number;
  bathrooms: number;
  areaSqft: number;
  parkingSpaces: number;
  photoCount: number;
  rentCheques: number[];
  qualityScore: number;
  publishedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
  lng: number;
  lat: number;
  amenitySlugs: string[];
  /** دقیق‌ترین مکان آگهی (محله یا برج) */
  place: PlaceNames & { type: 'community' | 'tower' | 'emirate'; path: string };
  community: PlaceNames;
  emirate: { nameFa: string; nameEn: string } | null;
  cover: {
    variants: MediaVariants | null;
    blurhash: string | null;
    width: number | null;
    height: number | null;
  } | null;
  /** چند عکس اول (شامل کاور) برای گالری کارت */
  photos: SearchCard['photos'];
  media: SearchCard['media'];
  agent: {
    id: string;
    name: string;
    avatarKey: string | null;
    isVerified: boolean;
    isTopAgent: boolean;
    agencyName: string | null;
  } | null;
}

export function buildCard(src: ListingSource): SearchCard {
  const isTower = src.place.type === 'tower';
  return {
    publicId: src.publicId,
    code: src.code,
    dealType: src.dealType,
    propertyType: src.propertyType,
    tier: src.tier,
    isVerified: src.isVerified,
    title: src.title,
    price: src.price,
    pricePerSqft: src.pricePerSqft,
    bedrooms: src.bedrooms,
    bathrooms: src.bathrooms,
    areaSqft: src.areaSqft,
    furnishing: src.furnishing,
    rentCheques: src.rentCheques,
    publishedAt: (src.publishedAt ?? src.createdAt).toISOString(),
    community: {
      slug: src.community.slug,
      nameFa: src.community.nameFa,
      nameEn: src.community.nameEn,
    },
    tower: isTower
      ? { slug: src.place.slug, nameFa: src.place.nameFa, nameEn: src.place.nameEn }
      : null,
    coordinates: { lng: src.lng, lat: src.lat },
    cover: src.cover,
    photoCount: src.photoCount,
    photos: src.photos,
    media: src.media,
    agent: src.agent
      ? {
          id: src.agent.id,
          name: src.agent.name,
          avatarKey: src.agent.avatarKey,
          isVerified: src.agent.isVerified,
          isTopAgent: src.agent.isTopAgent,
          agencyName: src.agent.agencyName,
        }
      : null,
  };
}

/** همه‌ی پیشوندهای مسیر: «a/b/c» → [«a»، «a/b»، «a/b/c»] */
export const pathPrefixes = (path: string): string[] => {
  const parts = path.split('/');
  return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
};

const joinSearch = (...parts: Array<string | null | undefined>) =>
  normalizeForSearch(parts.filter(Boolean).join(' '));

/** سند ایندکس از آگهی. `now` (unix ثانیه) فقط برای امتیاز تازگی است. */
export function buildListingDoc(src: ListingSource, now: number): ListingDoc {
  const published = unix(src.publishedAt ?? src.createdAt);
  const place = src.place;
  const hashAt = (precision: number) => encodeGeohash(src.lat, src.lng, precision);

  return {
    id: src.publicId,
    code: src.code,
    dealType: src.dealType,
    propertyType: src.propertyType,
    furnishing: src.furnishing,
    tier: src.tier,
    verified: src.isVerified ? 1 : 0,
    price: src.price,
    pricePerSqft: src.pricePerSqft,
    bedrooms: src.bedrooms,
    bathrooms: src.bathrooms,
    areaSqft: src.areaSqft,
    parkingSpaces: src.parkingSpaces,
    photoCount: src.photoCount,
    rentCheques: src.rentCheques,
    amenities: src.amenitySlugs,
    locationPaths: pathPrefixes(place.path),
    communitySlug: src.community.slug,
    agentId: src.agent?.id ?? '',
    qualityScore: src.qualityScore,
    rankScore: computeRankScore({
      qualityScore: src.qualityScore,
      photoCount: src.photoCount,
      isVerified: src.isVerified,
      isTopAgent: src.agent?.isTopAgent ?? false,
      publishedAt: published,
      now,
    }),
    publishedAt: published,
    expiresAt: src.expiresAt ? unix(src.expiresAt) : NEVER_EXPIRES,
    location: [src.lat, src.lng],
    geohash3: hashAt(3),
    geohash4: hashAt(4),
    geohash5: hashAt(5),
    geohash6: hashAt(6),
    searchTitle: joinSearch(src.title),
    searchPlace: joinSearch(
      src.community.nameFa,
      src.community.nameEn,
      ...src.community.aliases,
      place.type === 'tower' ? place.nameFa : null,
      place.type === 'tower' ? place.nameEn : null,
      ...(place.type === 'tower' ? place.aliases : []),
      src.emirate?.nameFa,
      src.emirate?.nameEn,
    ),
    searchAgent: joinSearch(src.agent?.name, src.agent?.agencyName),
    searchExtra: joinSearch(
      LABELS.propertyType[src.propertyType],
      LABELS.dealType[src.dealType],
      LABELS.furnishing[src.furnishing],
      bedroomsLabel(src.bedrooms),
    ),
    card: JSON.stringify(buildCard(src)),
  };
}

export function parseCard(doc: Pick<ListingDoc, 'card'>): SearchCard {
  return JSON.parse(doc.card) as SearchCard;
}

/* ───────────── پیشنهاد خودکار ───────────── */

export interface SuggestSource {
  kind: SuggestDoc['kind'];
  ref: string;
  label: string;
  sublabel: string | null;
  /** همه‌ی نام‌هایی که کاربر ممکن است تایپ کند */
  names: Array<string | null | undefined>;
  listingCount: number;
}

export function buildSuggestDoc(src: SuggestSource): SuggestDoc {
  return {
    id: `${src.kind}:${src.ref}`,
    kind: src.kind,
    ref: src.ref,
    label: src.label,
    sublabel: src.sublabel ?? '',
    searchText: joinSearch(...src.names),
    listingCount: src.listingCount,
  };
}
