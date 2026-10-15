import type {
  AlertChannel,
  AlertFrequency,
  DealType,
  Furnishing,
  LeadStatus,
  LeadType,
  ListingStatus,
  PropertyType,
} from '../domain.js';
import type { MediaVariants } from './media.js';

/**
 * شکل پاسخ‌های پنل کاربر و مقایسه (فقط تایپ).
 */

export interface AccountUser {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  role: 'user' | 'agent' | 'agency_manager' | 'admin';
  avatarKey: string | null;
}

export interface SavedSearchDto {
  id: string;
  name: string;
  /** query string استاندارد؛ لینک: /search?{query} */
  query: string;
  frequency: AlertFrequency;
  channels: AlertChannel[];
  lastNotifiedAt: string | null;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface MyLeadDto {
  id: string;
  type: LeadType;
  status: LeadStatus;
  message: string | null;
  createdAt: string;
  listing: { publicId: string; title: string; code: number } | null;
  agentName: string | null;
}

/** ستون مقایسه: یک ملک با همه‌ی ویژگی‌های قابل مقایسه */
export interface CompareItem {
  publicId: string;
  code: number;
  title: string;
  dealType: DealType;
  propertyType: PropertyType;
  price: number;
  pricePerSqft: number;
  bedrooms: number;
  bathrooms: number;
  areaSqft: number;
  floor: number | null;
  buildYear: number | null;
  furnishing: Furnishing;
  parkingSpaces: number;
  permitNumber: string | null;
  isVerified: boolean;
  status: ListingStatus;
  publishedAt: string | null;
  community: { slug: string; nameFa: string };
  tower: { nameFa: string } | null;
  cover: { variants: MediaVariants | null; blurhash: string | null; width: number | null; height: number | null } | null;
  agent: { id: string; name: string; isVerified: boolean } | null;
  amenities: Array<{ slug: string; nameFa: string }>;
}
