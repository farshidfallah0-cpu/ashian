import { z } from 'zod';
import { toEnglishDigits } from '../numbers.js';
import { phoneSchema } from './common.js';

export const OTP_LENGTH = 5;

export const requestOtpSchema = z.object({ phone: phoneSchema });
export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  /** کد با ارقام فارسی هم پذیرفته می‌شود */
  code: z
    .string()
    .transform((v) => toEnglishDigits(v).replace(/\s/g, ''))
    .pipe(z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), 'کد تأیید نامعتبر است')),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
