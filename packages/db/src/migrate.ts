/**
 * اجرای migrationها: `pnpm --filter @ashian/db migrate`
 * ایمن برای اجرای مکرر؛ migrationهای اجراشده دوباره اجرا نمی‌شوند.
 */
import { fileURLToPath } from 'node:url';
import { baseEnvSchema, databaseEnvSchema, loadRootEnv, parseEnv } from '@ashian/shared/env';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../drizzle', import.meta.url));

export async function runMigrations(url: string): Promise<void> {
  // PgBouncer در حالت transaction برای DDL مناسب نیست؛ migration مستقیم به Postgres
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  loadRootEnv();
  const env = parseEnv(baseEnvSchema.extend(databaseEnvSchema.shape));
  // اگر آدرس مخصوص migration داده شده (مستقیم، بدون PgBouncer) از آن استفاده می‌شود
  const url = process.env.DATABASE_MIGRATE_URL || env.DATABASE_URL;
  await runMigrations(url);
  console.warn('[db] migrationها اعمال شد.');
}
