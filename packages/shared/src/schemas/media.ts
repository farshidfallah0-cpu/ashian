import { z } from 'zod';
import { MEDIA_KINDS } from '../domain.js';
import { isPublicId } from '../public-id.js';

/** نوع فایل‌های مجاز برای آپلود؛ فقط این‌ها پذیرفته می‌شوند (محافظت از آپلود) */
export const UPLOAD_RULES = {
  image: {
    contentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const,
    maxBytes: 15 * 1024 * 1024,
  },
  floorplan: {
    contentTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
    maxBytes: 15 * 1024 * 1024,
  },
} as const;

export const MAX_MEDIA_PER_LISTING = 40;

export const presignMediaSchema = z
  .object({
    /** شناسه‌ی عمومی آگهی (همان که در URL است)، نه uuid داخلی */
    listingPublicId: z.string().refine(isPublicId, 'شناسه‌ی آگهی نامعتبر است'),
    kind: z.enum(MEDIA_KINDS).default('image'),
    contentType: z.string(),
    sizeBytes: z.number().int().positive(),
  })
  .superRefine((v, ctx) => {
    const rule = v.kind === 'floorplan' ? UPLOAD_RULES.floorplan : UPLOAD_RULES.image;
    if (v.kind !== 'image' && v.kind !== 'floorplan') {
      ctx.addIssue({
        code: 'custom',
        path: ['kind'],
        message: 'این نوع رسانه هنوز پشتیبانی نمی‌شود',
      });
      return;
    }
    if (!(rule.contentTypes as readonly string[]).includes(v.contentType)) {
      ctx.addIssue({ code: 'custom', path: ['contentType'], message: 'نوع فایل مجاز نیست' });
    }
    if (v.sizeBytes > rule.maxBytes) {
      ctx.addIssue({ code: 'custom', path: ['sizeBytes'], message: 'حجم فایل بیش از حد مجاز است' });
    }
  });
export type PresignMediaInput = z.infer<typeof presignMediaSchema>;

/** پسوند فایل از نوع محتوا (کلید ذخیره‌سازی هیچ‌وقت از نام فایل کاربر ساخته نمی‌شود) */
export const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** اندازه‌های تولیدشده برای هر تصویر؛ عرض به پیکسل */
export const IMAGE_WIDTHS = [320, 640, 960, 1280, 1920] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];
export type ImageFormat = 'avif' | 'webp';

/** ساختار variants که در جدول ذخیره می‌شود: variants.avif[640] = کلید فایل */
export type MediaVariants = Partial<Record<ImageFormat, Partial<Record<ImageWidth, string>>>>;
