import {
  baseEnvSchema,
  databaseEnvSchema,
  redisEnvSchema,
  storageEnvSchema,
  typesenseEnvSchema,
} from '@ashian/shared/env';
import { z } from 'zod';

/** env لازم برای ساخت آداپتورهای زیرساخت */
export const infraEnvSchema = baseEnvSchema
  .extend(databaseEnvSchema.shape)
  .extend(redisEnvSchema.shape)
  .extend(typesenseEnvSchema.shape)
  .extend(storageEnvSchema.shape)
  .extend({
    API_URL: z.url().default('http://localhost:4000'),
    MEDIA_SIGNING_SECRET: z.string().min(32),
    /** نشانی عمومی وب؛ برای لینک داخل پیامک و اعلان‌ها */
    WEB_URL: z.url().default('http://localhost:3000'),
    /** فاصله‌ی بررسی هشدار جستجوهای ذخیره‌شده (ثانیه) */
    ALERT_TICK_SECONDS: z.coerce.number().int().min(5).default(300),
  });

export type InfraEnv = z.infer<typeof infraEnvSchema>;
