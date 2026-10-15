import type {
  AmenityCategory,
  DealType,
  Furnishing,
  LeadType,
  ListingStatus,
  ListingTier,
  LocationType,
  MediaKind,
  MediaStatus,
  PropertyType,
} from '../domain.js';
import type { MediaVariants } from './media.js';

/**
 * شکل پاسخ‌های صفحه‌ی آگهی بین API و فرانت (فقط تایپ؛ هیچ مقدار زمان‌اجرایی ندارد تا
 * import در کد کلاینت چیزی به bundle اضافه نکند).
 */

export interface ListingDetailMedia {
  id: string;
  kind: MediaKind;
  position: number;
  status: MediaStatus;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  variants: MediaVariants | null;
  /** فقط برای ویدیو و تور ۳۶۰: کلید فایل یا آدرس https بیرونی */
  source: string | null;
}

export interface ListingDetailAgent {
  id: string;
  name: string;
  avatarKey: string | null;
  languages: string[];
  rating: number | null;
  reviewCount: number;
  avgResponseMinutes: number | null;
  isTopAgent: boolean;
  isVerified: boolean;
  activeListingCount: number;
  agency: { id: string; name: string; slug: string; logoKey: string | null } | null;
}

export interface ListingDetail {
  publicId: string;
  code: number;
  dealType: DealType;
  propertyType: PropertyType;
  status: ListingStatus;
  tier: ListingTier;
  isVerified: boolean;
  title: string;
  description: string;
  price: number;
  pricePerSqft: number;
  rentCheques: number[];
  deposit: number | null;
  bedrooms: number;
  bathrooms: number;
  areaSqft: number;
  floor: number | null;
  buildYear: number | null;
  furnishing: Furnishing;
  parkingSpaces: number;
  permitNumber: string | null;
  coordinates: { lng: number; lat: number };
  /** دقیق‌ترین مکان (برج یا محله) */
  place: { id: string; type: LocationType; slug: string; nameFa: string; nameEn: string };
  /** path مثل «dubai/dubai-marina» برای لینک به جستجو و لندینگ */
  community: { id: string; path: string; slug: string; nameFa: string; nameEn: string };
  media: ListingDetailMedia[];
  amenities: Array<{
    id: number;
    slug: string;
    nameFa: string;
    category: AmenityCategory;
    icon: string | null;
  }>;
  priceHistory: Array<{ price: number; changedAt: string }>;
  agent: ListingDetailAgent | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  isFavorite: boolean;
  isOwner: boolean;
}

/* ───────────── اطلاعات محله ───────────── */

export interface NeighborhoodStats {
  community: { slug: string; nameFa: string };
  dealType: DealType;
  /** همه‌ی آگهی‌های فعال هم‌نوع معامله در محله */
  all: { count: number; avgPrice: number; medianPrice: number; avgPricePerSqft: number };
  /** آگهی‌های هم‌تعداد خواب (null اگر نمونه کافی نیست) */
  sameBedrooms: { count: number; avgPrice: number; medianPrice: number } | null;
  /** درصد اختلاف این آگهی با میانگین هم‌تعداد خواب (منفی = ارزان‌تر)؛ null اگر نمونه کم است */
  priceDeltaPercent: number | null;
  /** درصد اختلاف قیمت هر فوت این آگهی با میانگین محله */
  psfDeltaPercent: number | null;
}

/* ───────────── نزدیک‌ترین‌ها ───────────── */

export const NEARBY_CATEGORIES = ['metro', 'school', 'hospital', 'mall'] as const;
export type NearbyCategory = (typeof NEARBY_CATEGORIES)[number];

export const NEARBY_LABELS: Record<NearbyCategory, string> = {
  metro: 'مترو',
  school: 'مدرسه',
  hospital: 'بیمارستان و درمانگاه',
  mall: 'مرکز خرید',
};

export interface NearbyPlace {
  category: NearbyCategory;
  nameFa: string;
  nameEn: string;
  /** فاصله‌ی هوایی به متر */
  distanceM: number;
  /** زمان تقریبی پیاده‌روی به دقیقه (فاصله‌ی هوایی × ضریب مسیر) */
  walkMinutes: number;
  lng: number;
  lat: number;
}

export interface NearbyResponse {
  items: NearbyPlace[];
}

/* ───────────── lead و گزارش ───────────── */

export interface LeadResponse {
  ok: true;
  type: LeadType;
  /** فقط برای call: شماره به‌صورت E.164 با + */
  phone?: string;
  /** فقط برای whatsapp */
  whatsappUrl?: string;
}
