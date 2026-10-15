import 'server-only';
import {
  LABELS,
  bedroomsLabel,
  formatArea,
  formatPrice,
  formatRent,
  type ListingDetail,
} from '@ashian/shared';
import type { Metadata } from 'next';
import { landingPath } from './landing';
import { mediaUrl } from './media';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

const DEAL_NOUN: Record<ListingDetail['dealType'], string> = {
  rent: 'اجاره',
  sale: 'فروش',
  full_mortgage: 'رهن کامل',
  short_term: 'اجاره‌ی کوتاه‌مدت',
};

export function priceLabel(l: Pick<ListingDetail, 'dealType' | 'price'>): string {
  if (l.dealType === 'rent') return formatRent(l.price, 'yearly');
  if (l.dealType === 'short_term') return formatRent(l.price, 'daily');
  return formatPrice(l.price);
}

/** «آپارتمان دو خوابه» یا «استودیو» */
export function typeAndBeds(l: Pick<ListingDetail, 'propertyType' | 'bedrooms'>): string {
  const type = LABELS.propertyType[l.propertyType];
  return l.bedrooms === 0 ? `${type} استودیو` : `${type} ${bedroomsLabel(l.bedrooms)}`;
}

/** نام دقیق‌ترین مکان با محله: «مارینا گیت ۱، دبی مارینا» */
export function placeName(l: Pick<ListingDetail, 'place' | 'community'>): string {
  return l.place.type === 'tower' ? `${l.place.nameFa}، ${l.community.nameFa}` : l.community.nameFa;
}

export function listingPath(publicId: string) {
  return `/listings/${publicId}`;
}

/** مسیر لندینگ سئوی محله (فقط اجاره و فروش لندینگ دارند) یا جستجوی معادل */
export function communityHref(l: Pick<ListingDetail, 'dealType' | 'community'>): string {
  if (l.dealType === 'rent' || l.dealType === 'sale') {
    return landingPath({ deal: l.dealType, location: l.community.path });
  }
  return `/search?dealType=${l.dealType}&location=${l.community.path}`;
}

export function dealHref(l: Pick<ListingDetail, 'dealType'>): string {
  return l.dealType === 'rent' || l.dealType === 'sale'
    ? `/${l.dealType}`
    : `/search?dealType=${l.dealType}`;
}

function shortText(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

function cover(l: ListingDetail) {
  const media = l.media.find((m) => m.kind === 'image' && m.status === 'ready' && m.variants);
  const key = media?.variants?.webp?.[1280] ?? media?.variants?.webp?.[960];
  if (!media || !key) return null;
  const width = media.variants?.webp?.[1280] ? 1280 : 960;
  const ratio = media.width && media.height ? media.height / media.width : 0.75;
  return { url: mediaUrl(key), width, height: Math.round(width * ratio) };
}

export function listingMetadata(l: ListingDetail): Metadata {
  const heading = `${DEAL_NOUN[l.dealType]} ${typeAndBeds(l)} در ${placeName(l)}`;
  const facts = `${heading}؛ ${formatArea(l.areaSqft)}، ${priceLabel(l)}. کد آگهی ${l.code}.`;
  const description = l.description ? `${facts} ${shortText(l.description, 110)}` : facts;
  const image = cover(l);
  const url = listingPath(l.publicId);
  return {
    title: l.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      siteName: 'آشیان',
      url,
      title: l.title,
      description,
      ...(image ? { images: [{ url: image.url, width: image.width, height: image.height }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: l.title,
      description,
      ...(image ? { images: [image.url] } : {}),
    },
  };
}

const SCHEMA_TYPE: Record<ListingDetail['propertyType'], string> = {
  apartment: 'Apartment',
  penthouse: 'Apartment',
  duplex: 'Apartment',
  villa: 'House',
  townhouse: 'House',
  hotel_apartment: 'Accommodation',
};

/** داده‌ی ساختاریافته‌ی schema.org: آگهی ملک + مسیر صفحه */
export function listingJsonLd(l: ListingDetail): Record<string, unknown>[] {
  const url = `${SITE_URL}${listingPath(l.publicId)}`;
  const images = l.media
    .filter((m) => m.kind === 'image' && m.status === 'ready')
    .flatMap((m) => {
      const key = m.variants?.webp?.[1280] ?? m.variants?.webp?.[960];
      return key ? [mediaUrl(key)] : [];
    })
    .slice(0, 8);

  const isRent = l.dealType === 'rent' || l.dealType === 'short_term';
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    url,
    price: l.price,
    priceCurrency: 'AED',
    availability: 'https://schema.org/InStock',
    businessFunction: isRent
      ? 'http://purl.org/goodrelations/v1#LeaseOut'
      : 'http://purl.org/goodrelations/v1#Sell',
    ...(l.publishedAt ? { validFrom: l.publishedAt } : {}),
    ...(l.expiresAt ? { priceValidUntil: l.expiresAt } : {}),
    ...(isRent
      ? {
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: l.price,
            priceCurrency: 'AED',
            unitCode: l.dealType === 'rent' ? 'ANN' : 'DAY',
          },
        }
      : {}),
    ...(l.agent
      ? {
          offeredBy: {
            '@type': 'RealEstateAgent',
            name: l.agent.name,
            ...(l.agent.agency ? { worksFor: { '@type': 'Organization', name: l.agent.agency.name } } : {}),
          },
        }
      : {}),
  };

  const listing: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': url,
    url,
    name: l.title,
    inLanguage: 'fa',
    description: shortText(l.description || l.title, 300),
    identifier: String(l.code),
    ...(l.publishedAt ? { datePosted: l.publishedAt } : {}),
    dateModified: l.updatedAt,
    ...(images.length ? { image: images } : {}),
    offers: offer,
    about: {
      '@type': SCHEMA_TYPE[l.propertyType],
      name: l.title,
      numberOfBedrooms: l.bedrooms,
      numberOfBathroomsTotal: l.bathrooms,
      floorSize: { '@type': 'QuantitativeValue', value: l.areaSqft, unitCode: 'FTK' },
      ...(l.floor !== null ? { floorLevel: String(l.floor) } : {}),
      ...(l.buildYear ? { yearBuilt: l.buildYear } : {}),
      address: {
        '@type': 'PostalAddress',
        addressLocality: l.community.nameEn,
        addressRegion: 'Dubai',
        addressCountry: 'AE',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: l.coordinates.lat,
        longitude: l.coordinates.lng,
      },
      ...(l.amenities.length
        ? {
            amenityFeature: l.amenities.map((a) => ({
              '@type': 'LocationFeatureSpecification',
              name: a.nameFa,
              value: true,
            })),
          }
        : {}),
    },
  };

  const crumbs = [
    { name: 'آشیان', item: SITE_URL },
    { name: LABELS.dealType[l.dealType], item: `${SITE_URL}${dealHref(l)}` },
    { name: l.community.nameFa, item: `${SITE_URL}${communityHref(l)}` },
    { name: l.title, item: url },
  ];
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.item,
    })),
  };
  return [listing, breadcrumbs];
}
