import 'server-only';
import type {
  ListingDetail,
  ListingDetailMedia,
  NearbyResponse,
  NeighborhoodStats,
  RentPeriod,
  SearchCard,
} from '@ashian/shared';
import { cache } from 'react';
import { apiFetch, apiGet, type ApiResult } from './api';
import { imageSources, mediaUrl } from './media';

/** ISR: ۶۰ ثانیه؛ تغییر قیمت و وضعیت آگهی حداکثر یک دقیقه بعد در صفحه دیده می‌شود */
const DETAIL_REVALIDATE = 60;
const EXTRAS_REVALIDATE = 300;

/** بین generateMetadata و صفحه یک بار فراخوانی می‌شود */
export const getListing = cache(
  (publicId: string): Promise<ApiResult<ListingDetail>> =>
    apiFetch<ListingDetail>(`/v1/listings/${publicId}`, { revalidate: DETAIL_REVALIDATE }),
);

export async function getSimilar(publicId: string): Promise<SearchCard[]> {
  return (
    (await apiGet<SearchCard[]>(`/v1/listings/${publicId}/similar`, {
      revalidate: EXTRAS_REVALIDATE,
    })) ?? []
  );
}

export async function getAgentListings(publicId: string): Promise<SearchCard[]> {
  return (
    (await apiGet<SearchCard[]>(`/v1/listings/${publicId}/agent-listings`, {
      revalidate: EXTRAS_REVALIDATE,
    })) ?? []
  );
}

export function getNeighborhood(publicId: string): Promise<NeighborhoodStats | null> {
  return apiGet<NeighborhoodStats>(`/v1/listings/${publicId}/neighborhood`, {
    revalidate: EXTRAS_REVALIDATE,
  });
}

export async function getNearby(publicId: string): Promise<NearbyResponse['items']> {
  const result = await apiGet<NearbyResponse>(`/v1/listings/${publicId}/nearby`, {
    revalidate: 3600,
  });
  return result?.items ?? [];
}

/* ───────────── رسانه ───────────── */

/** عکس آماده برای نمایش در گالری و لایت‌باکس (فقط رشته؛ قابل سریال‌سازی به کلاینت) */
export interface GalleryImage {
  id: string;
  alt: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  /** srcset کامل برای موزاییک صفحه */
  avif: string | null;
  webp: string | null;
  fallback: string | null;
}

export function toGalleryImage(media: ListingDetailMedia, alt: string): GalleryImage | null {
  const sources = imageSources(media.variants);
  if (!sources) return null;
  return {
    id: media.id,
    alt,
    width: media.width,
    height: media.height,
    blurhash: media.blurhash,
    avif: sources.avif,
    webp: sources.webp,
    fallback: sources.fallback,
  };
}

/** نسخه‌ی سبک برای لایت‌باکس: سه عرض و بدون blurhash اضافه */
export interface LightboxImage {
  alt: string;
  width: number | null;
  height: number | null;
  avif: string | null;
  webp: string | null;
  fallback: string | null;
  /** تصویر کوچک نوار پیش‌نمایش */
  thumb: string | null;
}

const LIGHTBOX_WIDTHS = [640, 1280, 1920] as const;

export function toLightboxImage(media: ListingDetailMedia, alt: string): LightboxImage | null {
  const sources = imageSources(media.variants, LIGHTBOX_WIDTHS);
  if (!sources) return null;
  const thumbKey = media.variants?.webp?.[320] ?? media.variants?.webp?.[640];
  return {
    alt,
    width: media.width,
    height: media.height,
    avif: sources.avif,
    webp: sources.webp,
    fallback: sources.fallback,
    thumb: thumbKey ? mediaUrl(thumbKey) : null,
  };
}

/** عکس‌های آماده‌ی یک نوع رسانه به ترتیب نمایش */
export function imagesOf(
  detail: ListingDetail,
  kind: 'image' | 'floorplan',
  labelOf: (index: number, total: number) => string,
): { gallery: GalleryImage[]; lightbox: LightboxImage[] } {
  const items = detail.media.filter((m) => m.kind === kind && m.status === 'ready');
  const gallery: GalleryImage[] = [];
  const lightbox: LightboxImage[] = [];
  items.forEach((m, i) => {
    const alt = labelOf(i, items.length);
    const full = toGalleryImage(m, alt);
    const light = toLightboxImage(m, alt);
    if (full && light) {
      gallery.push(full);
      lightbox.push(light);
    }
  });
  return { gallery, lightbox };
}

/* ───────────── قیمت ───────────── */

export const PRICE_PERIOD: Partial<Record<ListingDetail['dealType'], RentPeriod>> = {
  rent: 'yearly',
  short_term: 'daily',
};
