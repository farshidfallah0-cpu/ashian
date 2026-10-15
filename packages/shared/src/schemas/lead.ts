import { z } from 'zod';
import { LEAD_TYPES, REPORT_REASONS } from '../domain.js';
import { persianText, phoneSchema } from './common.js';

/**
 * سرنخ (lead): هر کلیک تماس، واتساپ، پیام یا درخواست بازدید روی صفحه‌ی آگهی.
 * شماره‌ی مشاور فقط در پاسخ همین درخواست برمی‌گردد (نه در API عمومی آگهی)؛ هم آمار دقیق می‌ماند
 * و هم شماره‌ها به‌صورت انبوه جمع نمی‌شوند.
 */
export const createLeadSchema = z.object({
  type: z.enum(LEAD_TYPES),
  /** مهمان باید نام و شماره بدهد؛ کاربر واردشده لازم نیست (سرور بررسی می‌کند) */
  name: persianText(2, 60).optional(),
  phone: phoneSchema.optional(),
  message: persianText(0, 1000).optional(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const reportListingSchema = z
  .object({
    reason: z.enum(REPORT_REASONS),
    details: persianText(0, 1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.reason === 'other' && (v.details?.length ?? 0) < 5) {
      ctx.addIssue({ code: 'custom', path: ['details'], message: 'لطفاً توضیح کوتاهی بنویسید' });
    }
  });
export type ReportListingInput = z.infer<typeof reportListingSchema>;
