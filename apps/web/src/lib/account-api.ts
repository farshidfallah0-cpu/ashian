import 'server-only';
import type {
  AccountUser,
  DealType,
  Furnishing,
  ListingStatus,
  MediaVariants,
  PropertyType,
} from '@ashian/shared';
import { cookies } from 'next/headers';

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const ACCESS_COOKIE = 'ashian_at';

export type AccountResult<T> = { ok: true; data: T } | { ok: false; status: number };

/**
 * خواندن داده‌ی مخصوص کاربر در سرور: کوکی دسترسی کاربر به API فرستاده می‌شود و هیچ‌چیز کش نمی‌شود.
 * صفحه‌های پنل به همین دلیل دینامیک‌اند (برخلاف صفحه‌ی آگهی و نتایج که ISR هستند).
 * وضعیت ۴۰۱ (توکن ۱۵ دقیقه‌ای منقضی) را به SessionGate می‌سپاریم تا در مرورگر نوسازی شود.
 */
export async function accountGet<T>(path: string): Promise<AccountResult<T>> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return { ok: false, status: 401 };
  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { cookie: `${ACCESS_COOKIE}=${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function getMe(): Promise<AccountResult<{ user: AccountUser }>> {
  return accountGet<{ user: AccountUser }>('/v1/auth/me');
}

/** کارت آگهی API (listing-card.ts در API) */
export interface ApiListingCard {
  publicId: string;
  code: number;
  dealType: DealType;
  propertyType: PropertyType;
  status: ListingStatus;
  tier: 'standard' | 'featured';
  isVerified: boolean;
  title: string;
  price: number;
  pricePerSqft: number;
  bedrooms: number;
  bathrooms: number;
  areaSqft: number;
  furnishing: Furnishing;
  publishedAt: string | null;
  expiresAt: string | null;
  community: { slug: string; nameFa: string; nameEn: string };
  cover: {
    variants: MediaVariants | null;
    blurhash: string | null;
    width: number | null;
    height: number | null;
  } | null;
  agent: { id: string; name: string; isVerified: boolean; isTopAgent: boolean } | null;
}

export interface ApiPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
