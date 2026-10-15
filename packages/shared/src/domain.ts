/**
 * انواع دامنه‌ی ملک. تنها منبع حقیقت برای دیتابیس، API و فرانت.
 * هر فهرست یک tuple ثابت است تا هم برای pgEnum و هم برای z.enum استفاده شود.
 */

export const USER_ROLES = ['user', 'agent', 'agency_manager', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'blocked'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const LOCATION_TYPES = ['emirate', 'community', 'tower'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const DEAL_TYPES = ['rent', 'sale', 'full_mortgage', 'short_term'] as const;
export type DealType = (typeof DEAL_TYPES)[number];

export const PROPERTY_TYPES = [
  'apartment',
  'villa',
  'townhouse',
  'penthouse',
  'duplex',
  'hotel_apartment',
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const FURNISHING_TYPES = ['furnished', 'semi_furnished', 'unfurnished'] as const;
export type Furnishing = (typeof FURNISHING_TYPES)[number];

export const LISTING_STATUSES = [
  'draft',
  'pending_review',
  'active',
  'paused',
  'rejected',
  'expired',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_TIERS = ['standard', 'featured'] as const;
export type ListingTier = (typeof LISTING_TIERS)[number];

export const MEDIA_KINDS = ['image', 'video', 'tour360', 'floorplan'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_STATUSES = ['pending', 'processing', 'ready', 'failed'] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const LEAD_TYPES = ['call', 'whatsapp', 'message', 'visit_request'] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_STATUSES = ['new', 'contacted', 'viewing', 'closed'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const ALERT_FREQUENCIES = ['instant', 'daily', 'weekly', 'none'] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];

export const ALERT_CHANNELS = ['push', 'email', 'sms'] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export const REPORT_REASONS = [
  'wrong_info',
  'duplicate',
  'unavailable',
  'fraud',
  'inappropriate',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const AMENITY_CATEGORIES = ['building', 'unit', 'view', 'policy'] as const;
export type AmenityCategory = (typeof AMENITY_CATEGORIES)[number];

/** برچسب‌های فارسی برای نمایش */
export const LABELS = {
  dealType: {
    rent: 'اجاره',
    sale: 'فروش',
    full_mortgage: 'رهن کامل',
    short_term: 'اجاره‌ی کوتاه‌مدت',
  },
  propertyType: {
    apartment: 'آپارتمان',
    villa: 'ویلا',
    townhouse: 'تاون‌هاوس',
    penthouse: 'پنت‌هاوس',
    duplex: 'دوبلکس',
    hotel_apartment: 'هتل‌آپارتمان',
  },
  furnishing: {
    furnished: 'مبله',
    semi_furnished: 'نیمه‌مبله',
    unfurnished: 'بدون مبلمان',
  },
  listingStatus: {
    draft: 'پیش‌نویس',
    pending_review: 'در انتظار تأیید',
    active: 'فعال',
    paused: 'متوقف',
    rejected: 'ردشده',
    expired: 'منقضی',
  },
  leadType: {
    call: 'تماس',
    whatsapp: 'واتساپ',
    message: 'پیام',
    visit_request: 'درخواست بازدید',
  },
  alertFrequency: {
    instant: 'فوری',
    daily: 'روزانه',
    weekly: 'هفتگی',
    none: 'بدون هشدار',
  },
  alertChannel: {
    push: 'اعلان در سایت',
    email: 'ایمیل',
    sms: 'پیامک',
  },
  leadStatus: {
    new: 'ارسال شد',
    contacted: 'پاسخ داده شد',
    viewing: 'بازدید هماهنگ شد',
    closed: 'بسته شد',
  },
  reportReason: {
    wrong_info: 'اطلاعات نادرست (قیمت، متراژ، عکس)',
    duplicate: 'آگهی تکراری',
    unavailable: 'ملک دیگر موجود نیست',
    fraud: 'کلاهبرداری یا مشکوک',
    inappropriate: 'محتوای نامناسب',
    other: 'مورد دیگر',
  },
  amenityCategory: {
    building: 'ساختمان و مجتمع',
    unit: 'داخل واحد',
    view: 'منظره',
    policy: 'قوانین',
  },
  userRole: {
    user: 'کاربر',
    agent: 'مشاور',
    agency_manager: 'مدیر آژانس',
    admin: 'ادمین',
  },
} as const;

/** تعداد خواب → متن: ۰ = استودیو */
export function bedroomsLabel(bedrooms: number): string {
  if (bedrooms === 0) return 'استودیو';
  const words = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت'];
  return `${words[bedrooms] ?? bedrooms} خوابه`;
}
