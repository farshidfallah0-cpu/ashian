/**
 * بارگذاری و اعتبارسنجی متغیرهای محیطی — فقط سمت سرور.
 * همه‌ی برنامه‌ها فایل .env ریشه‌ی monorepo را می‌خوانند.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';

/** نزدیک‌ترین .env را از پوشه‌ی جاری به بالا پیدا و بارگذاری می‌کند. متغیرهای موجود بازنویسی نمی‌شوند. */
export function loadRootEnv(startDir: string = process.cwd()): string | null {
  let dir = resolve(startDir);
  for (;;) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return dir;
    }
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return null;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** ریشه‌ی monorepo (پوشه‌ای که pnpm-workspace.yaml دارد) */
export function findRepoRoot(startDir: string = process.cwd()): string {
  let dir = resolve(startDir);
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return resolve(startDir);
    dir = parent;
  }
}

export class EnvValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`متغیرهای محیطی نامعتبر:\n  - ${issues.join('\n  - ')}`);
    this.name = 'EnvValidationError';
  }
}

export function parseEnv<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(
      result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    );
  }
  return result.data;
}

/** رشته‌ی خالی را undefined در نظر می‌گیرد تا مقدار پیش‌فرض اعمال شود */
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v === '' ? undefined : v));

/** بخش‌های مشترک env که چند برنامه به آن نیاز دارند */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  INFRA_MODE: z.enum(['lite', 'full']).default('lite'),
});

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_REPLICA_URL: optionalString.pipe(z.url().optional()),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(200).default(10),
  LITE_DB_DIR: z.string().default('.data/pglite'),
});

export const redisEnvSchema = z.object({
  REDIS_URL: z.url().default('redis://localhost:6379'),
});

export const typesenseEnvSchema = z.object({
  TYPESENSE_URL: z.url().default('http://localhost:8108'),
  /** کلید پیش‌فرض فقط برای توسعه است؛ در production باید حتماً تنظیم شود */
  TYPESENSE_API_KEY: z.string().min(1).default('ashian-dev-key'),
});

export const storageEnvSchema = z.object({
  S3_ENDPOINT: optionalString.pipe(z.url().optional()),
  S3_REGION: z.string().default('me-central-1'),
  S3_BUCKET: z.string().default('ashian-media'),
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_PUBLIC_URL: optionalString.pipe(z.url().optional()),
  STORAGE_LOCAL_DIR: z.string().default('.data/uploads'),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type RedisEnv = z.infer<typeof redisEnvSchema>;
export type TypesenseEnv = z.infer<typeof typesenseEnvSchema>;
export type StorageEnv = z.infer<typeof storageEnvSchema>;
