import { z } from 'zod';
import { MARKET } from '../market.js';
import { normalizePersian } from '../normalize.js';
import { toEnglishDigits } from '../numbers.js';

/** رشته‌ی فارسی یکسان‌شده؛ هر ورودی متنی از این عبور می‌کند */
export const persianText = (min = 0, max = 500) =>
  z
    .string()
    .transform((v) => normalizePersian(v))
    .pipe(z.string().min(min).max(max));

/**
 * شماره‌ی موبایل بین‌المللی. ورودی با ارقام فارسی/عربی، فاصله، خط تیره و
 * پیشوندهای 00 یا + پذیرفته می‌شود و به شکل E.164 بدون + ذخیره می‌شود («971501234567»).
 * شماره‌ی محلی (با 0 اول) با پیش‌شماره‌ی پیش‌فرض بازار کامل می‌شود.
 */
export const phoneSchema = z
  .string()
  .transform((raw) => {
    let digits = toEnglishDigits(raw).replace(/[\s\-().]/g, '');
    if (digits.startsWith('+')) digits = digits.slice(1);
    else if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = MARKET.phone.defaultCountryCode + digits.slice(1);
    return digits;
  })
  .pipe(
    z
      .string()
      .regex(/^\d{8,15}$/, 'شماره‌ی موبایل نامعتبر است')
      .refine(
        (v) => MARKET.phone.allowedCountryCodes.some((code) => v.startsWith(code)),
        'پیش‌شماره‌ی کشور پشتیبانی نمی‌شود',
      ),
  );

export const uuidSchema = z.uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;
