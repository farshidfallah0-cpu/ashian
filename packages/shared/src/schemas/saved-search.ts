import { z } from 'zod';
import { ALERT_CHANNELS, ALERT_FREQUENCIES } from '../domain.js';
import { persianText } from './common.js';

/**
 * ذخیره‌ی جستجو (و هشدار آگهی تازه). `query` همان query string صفحه‌ی نتایج است
 * (بدون page)، تا بعداً دقیقاً همان صفحه باز شود و job هشدار همان فیلترها را اجرا کند.
 */
export const createSavedSearchSchema = z.object({
  name: persianText(2, 80),
  query: z.string().max(1500),
  frequency: z.enum(ALERT_FREQUENCIES).default('daily'),
  /** کانال‌های اعلان؛ push = اعلان داخل سایت */
  channels: z.array(z.enum(ALERT_CHANNELS)).min(1).max(3).default(['push']),
});
export type CreateSavedSearchInput = z.infer<typeof createSavedSearchSchema>;

/** ویرایش هشدار و نام یک جستجوی ذخیره‌شده */
export const updateSavedSearchSchema = z
  .object({
    name: persianText(2, 80),
    frequency: z.enum(ALERT_FREQUENCIES),
    channels: z.array(z.enum(ALERT_CHANNELS)).min(1).max(3),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'چیزی برای ویرایش نیست');
export type UpdateSavedSearchInput = z.infer<typeof updateSavedSearchSchema>;

export const MAX_SAVED_SEARCHES = 30;
