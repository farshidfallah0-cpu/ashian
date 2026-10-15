import { z } from 'zod';
import { persianText } from './common.js';

/** ویرایش پروفایل؛ ایمیل خالی یعنی حذف ایمیل */
export const updateProfileSchema = z
  .object({
    name: persianText(2, 60),
    email: z.union([
      z.literal('').transform(() => null),
      z
        .string()
        .trim()
        .toLowerCase()
        .max(120)
        .pipe(z.email('ایمیل نامعتبر است')),
    ]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'چیزی برای ویرایش نیست');
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
