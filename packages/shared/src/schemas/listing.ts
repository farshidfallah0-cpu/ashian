import { z } from 'zod';
import {
  DEAL_TYPES,
  FURNISHING_TYPES,
  LISTING_TIERS,
  PROPERTY_TYPES,
  type DealType,
} from '../domain.js';
import { MARKET } from '../market.js';
import { persianText, uuidSchema } from './common.js';

/**
 * محدوده‌ی منطقی برای هر مقدار. خارج از «حد مجاز» ورود رد می‌شود؛
 * خارج از «حد معمول» (ولی داخل حد مجاز) فقط هشدار کیفیت می‌گیرد و مرحله‌ی ۹ آن را به کاربر نشان می‌دهد.
 * (درس از Property Finder که یک تاون‌هاوس ۴۱ هزار فوتی داشت.)
 */
export const LIMITS = {
  areaSqft: { hardMin: 100, hardMax: 100_000, softMin: 250, softMax: 12_000 },
  bedrooms: { min: 0, max: 12 },
  bathrooms: { min: 1, max: 14 },
  rentYearly: { hardMin: 5_000, hardMax: 20_000_000 },
  sale: { hardMin: 50_000, hardMax: 2_000_000_000 },
  /** بازه‌ی منطقی قیمت هر فوت مربع برای فروش */
  salePricePerSqft: { softMin: 300, softMax: 12_000 },
} as const;

export const listingBaseShape = {
  dealType: z.enum(DEAL_TYPES),
  propertyType: z.enum(PROPERTY_TYPES),
  /** دقیق‌ترین مکان انتخاب‌شده: برج یا محله */
  locationId: uuidSchema,
  title: persianText(8, 120),
  description: persianText(0, 5000).default(''),
  /** اجاره: اجاره‌ی سالانه. فروش: قیمت کل. رهن کامل: مبلغ رهن. کوتاه‌مدت: قیمت هر شب */
  price: z.number().int().positive(),
  /** فقط اجاره: تعداد چک‌های پذیرفته‌شده */
  rentCheques: z.array(z.number().int().min(1).max(12)).max(6).default([]),
  /** ودیعه (اجاره) */
  deposit: z.number().int().min(0).nullable().default(null),
  bedrooms: z.number().int().min(LIMITS.bedrooms.min).max(LIMITS.bedrooms.max),
  bathrooms: z.number().int().min(LIMITS.bathrooms.min).max(LIMITS.bathrooms.max),
  areaSqft: z.number().int().min(LIMITS.areaSqft.hardMin).max(LIMITS.areaSqft.hardMax),
  floor: z.number().int().min(-2).max(200).nullable().default(null),
  buildYear: z
    .number()
    .int()
    .min(1960)
    .max(new Date().getFullYear() + 6)
    .nullable()
    .default(null),
  furnishing: z.enum(FURNISHING_TYPES),
  parkingSpaces: z.number().int().min(0).max(10).default(0),
  /** شماره‌ی مجوز تبلیغ (Trakheesi/RERA) */
  permitNumber: z.string().trim().max(40).nullable().default(null),
  amenityIds: z.array(z.number().int().positive()).max(60).default([]),
  /** مختصات نقطه‌ی ملک؛ اگر نبود از مرکز مکان انتخاب‌شده استفاده می‌شود */
  lng: z.number().min(MARKET.map.bounds[0]).max(MARKET.map.bounds[2]).nullable().default(null),
  lat: z.number().min(MARKET.map.bounds[1]).max(MARKET.map.bounds[3]).nullable().default(null),
};

function priceRangeFor(deal: DealType): [number, number] {
  switch (deal) {
    case 'sale':
      return [LIMITS.sale.hardMin, LIMITS.sale.hardMax];
    case 'short_term':
      return [100, 100_000];
    default:
      return [LIMITS.rentYearly.hardMin, LIMITS.rentYearly.hardMax];
  }
}

function refineListing(
  v: { dealType: DealType; price: number; bedrooms: number; areaSqft: number },
  ctx: z.RefinementCtx,
) {
  const [min, max] = priceRangeFor(v.dealType);
  if (v.price < min || v.price > max) {
    ctx.addIssue({
      code: 'custom',
      path: ['price'],
      message: `قیمت باید بین ${min.toLocaleString('en')} و ${max.toLocaleString('en')} ${MARKET.currency.code} باشد`,
    });
  }
  // هر خواب دست‌کم حدود ۱۲۰ فوت (≈۱۱ متر) لازم دارد
  if (v.bedrooms > 0 && v.areaSqft < v.bedrooms * 120) {
    ctx.addIssue({
      code: 'custom',
      path: ['areaSqft'],
      message: 'متراژ برای این تعداد خواب خیلی کم است',
    });
  }
}

export const createListingSchema = z.object(listingBaseShape).superRefine(refineListing);
export type CreateListingInput = z.infer<typeof createListingSchema>;

/**
 * شکل ویرایش: همان فیلدها بدون مقدار پیش‌فرض. اگر پیش‌فرض‌ها بماند، `.partial()` هنگام نبودن فیلد
 * مقدار پیش‌فرض را می‌گذارد و یک PATCH ساده‌ی قیمت، مختصات، توضیحات و امکانات آگهی را پاک می‌کند.
 */
const listingPatchShape = Object.fromEntries(
  Object.entries(listingBaseShape).map(([key, field]) => [
    key,
    field instanceof z.ZodDefault ? field.removeDefault() : field,
  ]),
) as unknown as typeof listingBaseShape;

/** ویرایش: همه‌ی فیلدها اختیاری، ولی اگر بودند معتبر باشند */
export const updateListingSchema = z
  .object(listingPatchShape)
  .partial()
  .superRefine((v, ctx) => {
    if (
      v.dealType &&
      v.price !== undefined &&
      v.bedrooms !== undefined &&
      v.areaSqft !== undefined
    ) {
      refineListing(
        { dealType: v.dealType, price: v.price, bedrooms: v.bedrooms, areaSqft: v.areaSqft },
        ctx,
      );
    }
  });
export type UpdateListingInput = z.infer<typeof updateListingSchema>;

/**
 * اعتبارسنجی «نیمه‌کاره» برای ویزارد ثبت آگهی: فقط فیلدهایی که کاربر تا اینجا پر کرده بررسی می‌شوند
 * و خطای هر فیلد (به فارسی) برمی‌گردد؛ قواعد بین‌فیلدی وقتی فیلدهایشان هست اجرا می‌شوند.
 * سرور تنها منبع قواعد است (فرانت zod را وارد bundle نمی‌کند).
 */
export function validateListingPartial(
  input: unknown,
  neighborhoodAvgPricePerSqft?: number,
): { errors: Record<string, string>; warnings: QualityWarning[] } {
  const errors: Record<string, string> = {};
  const parsed = z.object(listingPatchShape).partial().safeParse(input);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? '_')] ??= issue.message;
    return { errors, warnings: [] };
  }
  const v = parsed.data;
  // بازه‌ی قیمت فقط به نوع معامله و قیمت نیاز دارد (قبل از پر شدن خواب و متراژ هم نشان داده شود)
  if (v.dealType && v.price !== undefined) {
    const [min, max] = priceRangeFor(v.dealType);
    if (v.price < min || v.price > max) {
      errors.price = `قیمت باید بین ${min.toLocaleString('en')} و ${max.toLocaleString('en')} ${MARKET.currency.code} باشد`;
    }
  }
  if (
    v.dealType &&
    v.price !== undefined &&
    v.bedrooms !== undefined &&
    v.areaSqft !== undefined
  ) {
    const cross = z
      .object({
        dealType: z.enum(DEAL_TYPES),
        price: z.number(),
        bedrooms: z.number(),
        areaSqft: z.number(),
      })
      .superRefine(refineListing)
      .safeParse(v);
    if (!cross.success) {
      for (const issue of cross.error.issues)
        errors[String(issue.path[0] ?? '_')] ??= issue.message;
    }
    if (Object.keys(errors).length === 0) {
      return {
        errors,
        warnings: detectQualityWarnings(
          { dealType: v.dealType, price: v.price, bedrooms: v.bedrooms, areaSqft: v.areaSqft },
          neighborhoodAvgPricePerSqft,
        ),
      };
    }
  }
  return { errors, warnings: [] };
}

export const listingTierSchema = z.enum(LISTING_TIERS);

export interface QualityWarning {
  field: 'areaSqft' | 'price' | 'bedrooms';
  code: 'area_unusual' | 'price_per_sqft_unusual' | 'beds_vs_area';
  message: string;
}

/**
 * هشدارهای «داده‌ی غیرعادی»؛ مانع ثبت نمی‌شوند ولی کاربر باید تأیید کند
 * و ادمین در صف کیفیت می‌بیند. میانگین محله اختیاری است (مرحله ۹ پر می‌کند).
 */
export function detectQualityWarnings(
  v: { dealType: DealType; price: number; bedrooms: number; areaSqft: number },
  neighborhoodAvgPricePerSqft?: number,
): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  const { areaSqft } = LIMITS;

  if (v.areaSqft < areaSqft.softMin || v.areaSqft > areaSqft.softMax) {
    warnings.push({
      field: 'areaSqft',
      code: 'area_unusual',
      message: 'متراژ خارج از محدوده‌ی معمول است؛ لطفاً واحد (فوت مربع) را بررسی کنید.',
    });
  }

  if (v.dealType === 'sale' && v.areaSqft > 0) {
    const perSqft = v.price / v.areaSqft;
    const { salePricePerSqft } = LIMITS;
    const outsideGlobal = perSqft < salePricePerSqft.softMin || perSqft > salePricePerSqft.softMax;
    const outsideLocal =
      neighborhoodAvgPricePerSqft !== undefined &&
      (perSqft < neighborhoodAvgPricePerSqft * 0.4 || perSqft > neighborhoodAvgPricePerSqft * 2.5);
    if (outsideGlobal || outsideLocal) {
      warnings.push({
        field: 'price',
        code: 'price_per_sqft_unusual',
        message: 'قیمت هر فوت مربع با میانگین بازار فاصله‌ی زیادی دارد.',
      });
    }
  }

  if (v.bedrooms >= 3 && v.areaSqft < v.bedrooms * 300) {
    warnings.push({
      field: 'bedrooms',
      code: 'beds_vs_area',
      message: 'تعداد خواب با متراژ هم‌خوانی ندارد.',
    });
  }
  return warnings;
}
