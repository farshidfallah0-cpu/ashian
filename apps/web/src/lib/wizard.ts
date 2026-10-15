import type { DealType, Furnishing, ListingDetail, PropertyType } from '@ashian/shared';

/**
 * وضعیت ویزارد ثبت و ویرایش آگهی. اعتبارسنجی واقعی فقط در API است (POST /v1/listings/validate)؛
 * اینجا zod وارد نمی‌شود تا JavaScript اولیه‌ی صفحه سبک بماند.
 */

export const STEPS = [
  { id: 'deal', label: 'نوع آگهی' },
  { id: 'location', label: 'موقعیت' },
  { id: 'specs', label: 'مشخصات' },
  { id: 'price', label: 'قیمت' },
  { id: 'amenities', label: 'امکانات' },
  { id: 'media', label: 'عکس‌ها' },
  { id: 'text', label: 'عنوان و توضیحات' },
  { id: 'review', label: 'پیش‌نمایش و ارسال' },
] as const;

export type StepId = (typeof STEPS)[number]['id'];

export interface Draft {
  /** بعد از ساخته شدن پیش‌نویس روی سرور پر می‌شود */
  publicId: string | null;
  dealType: DealType | null;
  propertyType: PropertyType | null;
  locationId: string | null;
  /** فقط برای نمایش (نام برج/محله‌ی انتخاب‌شده) */
  placeLabel: string;
  lng: number | null;
  lat: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  /** همیشه فوت مربع (واحد ذخیره‌سازی) */
  areaSqft: number | null;
  floor: number | null;
  buildYear: number | null;
  furnishing: Furnishing | null;
  parkingSpaces: number;
  permitNumber: string;
  price: number | null;
  rentCheques: number[];
  deposit: number | null;
  amenityIds: number[];
  title: string;
  description: string;
}

export const EMPTY_DRAFT: Draft = {
  publicId: null,
  dealType: null,
  propertyType: null,
  locationId: null,
  placeLabel: '',
  lng: null,
  lat: null,
  bedrooms: null,
  bathrooms: null,
  areaSqft: null,
  floor: null,
  buildYear: null,
  furnishing: null,
  parkingSpaces: 0,
  permitNumber: '',
  price: null,
  rentCheques: [],
  deposit: null,
  amenityIds: [],
  title: '',
  description: '',
};

/** فیلدهای ارسالی به API (create/update/validate) */
export function toPayload(draft: Draft) {
  return {
    dealType: draft.dealType ?? undefined,
    propertyType: draft.propertyType ?? undefined,
    locationId: draft.locationId ?? undefined,
    lng: draft.lng,
    lat: draft.lat,
    bedrooms: draft.bedrooms ?? undefined,
    bathrooms: draft.bathrooms ?? undefined,
    areaSqft: draft.areaSqft ?? undefined,
    floor: draft.floor,
    buildYear: draft.buildYear,
    furnishing: draft.furnishing ?? undefined,
    parkingSpaces: draft.parkingSpaces,
    permitNumber: draft.permitNumber.trim() || null,
    price: draft.price ?? undefined,
    rentCheques: draft.dealType === 'rent' ? draft.rentCheques : [],
    deposit: draft.dealType === 'rent' ? draft.deposit : null,
    amenityIds: draft.amenityIds,
    title: draft.title.trim() || undefined,
    description: draft.description.trim(),
  };
}

/** فیلدهای هر مرحله که برای «ادامه» لازم‌اند (کلید خطای API هم همین‌هاست) */
export const REQUIRED: Record<StepId, Array<keyof Draft>> = {
  deal: ['dealType', 'propertyType'],
  location: ['locationId'],
  specs: ['bedrooms', 'bathrooms', 'areaSqft', 'furnishing'],
  price: ['price'],
  amenities: [],
  media: [],
  text: ['title'],
  review: [],
};

/** کدام مرحله صاحب این فیلد (برای برگرداندن کاربر به مرحله‌ی خطادار) */
export const STEP_OF_FIELD: Record<string, StepId> = {
  dealType: 'deal',
  propertyType: 'deal',
  locationId: 'location',
  lng: 'location',
  lat: 'location',
  bedrooms: 'specs',
  bathrooms: 'specs',
  areaSqft: 'specs',
  floor: 'specs',
  buildYear: 'specs',
  furnishing: 'specs',
  parkingSpaces: 'specs',
  permitNumber: 'specs',
  price: 'price',
  rentCheques: 'price',
  deposit: 'price',
  amenityIds: 'amenities',
  title: 'text',
  description: 'text',
};

export function isStepComplete(step: StepId, draft: Draft): boolean {
  return REQUIRED[step].every((key) => {
    const value = draft[key];
    return value !== null && value !== '' && value !== undefined;
  });
}

/** پیش‌نویس سرور (جزئیات آگهی) → وضعیت ویزارد */
export function draftFromListing(listing: ListingDetail): Draft {
  return {
    publicId: listing.publicId,
    dealType: listing.dealType,
    propertyType: listing.propertyType,
    locationId: listing.place.id,
    placeLabel:
      listing.place.type === 'tower'
        ? `${listing.place.nameFa}، ${listing.community.nameFa}`
        : listing.community.nameFa,
    lng: listing.coordinates.lng,
    lat: listing.coordinates.lat,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    areaSqft: listing.areaSqft,
    floor: listing.floor,
    buildYear: listing.buildYear,
    furnishing: listing.furnishing,
    parkingSpaces: listing.parkingSpaces,
    permitNumber: listing.permitNumber ?? '',
    price: listing.price,
    rentCheques: listing.rentCheques,
    deposit: listing.deposit,
    amenityIds: listing.amenities.map((a) => a.id),
    title: listing.title,
    description: listing.description,
  };
}

const DEAL_WORD: Record<DealType, string> = {
  rent: 'برای اجاره',
  sale: 'برای فروش',
  full_mortgage: 'برای رهن کامل',
  short_term: 'برای اجاره‌ی کوتاه‌مدت',
};
const TYPE_WORD: Record<PropertyType, string> = {
  apartment: 'آپارتمان',
  villa: 'ویلا',
  townhouse: 'تاون‌هاوس',
  penthouse: 'پنت‌هاوس',
  duplex: 'دوبلکس',
  hotel_apartment: 'هتل‌آپارتمان',
};
const BEDS_WORD = ['استودیو', 'یک خوابه', 'دو خوابه', 'سه خوابه', 'چهار خوابه', 'پنج خوابه'];

/** عنوان پیشنهادی: «آپارتمان دو خوابه برای اجاره در دبی مارینا» */
export function suggestTitle(draft: Draft): string {
  if (!draft.propertyType || !draft.dealType) return '';
  const beds =
    draft.bedrooms === null
      ? ''
      : draft.bedrooms === 0
        ? ' استودیو'
        : ` ${BEDS_WORD[draft.bedrooms] ?? `${draft.bedrooms} خوابه`}`;
  const place = draft.placeLabel ? ` در ${draft.placeLabel.split('،')[0]}` : '';
  return `${TYPE_WORD[draft.propertyType]}${beds} ${DEAL_WORD[draft.dealType]}${place}`.trim();
}

/* ───────────── ذخیره‌ی محلی (پیش از ساخت پیش‌نویس روی سرور) ───────────── */

export const LOCAL_KEY = 'ashian:new-listing';

export function loadLocal(): { draft: Draft; step: StepId } | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { draft?: Partial<Draft>; step?: StepId };
    if (!parsed.draft) return null;
    return { draft: { ...EMPTY_DRAFT, ...parsed.draft }, step: parsed.step ?? 'deal' };
  } catch {
    return null;
  }
}

export function saveLocal(draft: Draft, step: StepId): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ draft, step }));
  } catch {
    /* حالت خصوصی مرورگر */
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* حالت خصوصی مرورگر */
  }
}

/** ارقام فارسی/عربی → عدد؛ جداکننده‌های هزارگان نادیده گرفته می‌شوند. خالی یا نامعتبر = null */
export function parseNumberInput(raw: string): number | null {
  const latin = raw
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,،٬\s']/g, '')
    .replace(/٫/g, '.');
  if (!/^\d+(\.\d+)?$/.test(latin)) return null;
  const value = Number(latin);
  return Number.isFinite(value) ? value : null;
}

export const SQFT_PER_SQM = 10.7639104167;

export const faNumber = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
