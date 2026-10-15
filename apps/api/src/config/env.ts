import { infraEnvSchema } from '@ashian/infra';
import { parseEnv } from '@ashian/shared/env';
import { z } from 'zod';

export const apiEnvSchema = infraEnvSchema.extend({
  API_PORT: z.coerce.number().int().default(4000),
  WEB_URL: z.url().default('http://localhost:3000'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(120),
  SMS_PROVIDER: z.enum(['console']).default('console'),
  /** دامنه‌ی کوکی (مثلاً .ashian.ae)؛ خالی = همان هاست */
  COOKIE_DOMAIN: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const API_ENV = Symbol('API_ENV');

export function loadApiEnv(): ApiEnv {
  return parseEnv(apiEnvSchema);
}
