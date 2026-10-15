import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

export type Schema = typeof schema;
export type Database = NodePgDatabase<Schema>;

export interface DbOptions {
  url: string;
  /** replica فقط‌خواندنی؛ اگر نباشد خواندن هم از primary انجام می‌شود */
  replicaUrl?: string | undefined;
  poolMax?: number;
  /** نام برنامه برای دیدن در pg_stat_activity */
  applicationName?: string;
  /** سقف زمان یک کوئری (میلی‌ثانیه)؛ کوئری گیرکرده نباید اتصال را ابدی نگه دارد */
  statementTimeoutMs?: number;
}

export interface DbClient {
  /** نوشتن و خواندن‌هایی که باید فوراً سازگار باشند */
  primary: Database;
  /** خواندن‌های سنگین و قابل تأخیر (لیست‌ها، آمار) */
  replica: Database;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

/**
 * node-postgres: هر کوئری را در یک بسته‌ی پروتکل می‌فرستد و prepared statement نام‌دار نمی‌سازد؛
 * هم با PgBouncer (حالت transaction) و هم با PGlite (حالت lite، session مشترک) درست کار می‌کند.
 */
function createPool(url: string, options: DbOptions): pg.Pool {
  const parsed = new URL(url);
  parsed.searchParams.delete('pgbouncer'); // پارامتر مخصوص ابزارهای دیگر؛ pg آن را نمی‌شناسد

  const pool = new pg.Pool({
    connectionString: parsed.toString(),
    max: options.poolMax ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: options.applicationName ?? 'ashian',
    statement_timeout: options.statementTimeoutMs ?? 30_000,
  });
  // خطای اتصال idle نباید پروسه را بکشد (Postgres ری‌استارت، قطع شبکه…)
  pool.on('error', (error) => console.error('[db] خطای اتصال idle:', error.message));
  return pool;
}

export function createDb(options: DbOptions): DbClient {
  const primaryPool = createPool(options.url, options);
  const replicaPool = options.replicaUrl ? createPool(options.replicaUrl, options) : primaryPool;

  const primary = drizzle(primaryPool, { schema, casing: 'snake_case' });
  const replica =
    replicaPool === primaryPool ? primary : drizzle(replicaPool, { schema, casing: 'snake_case' });

  return {
    primary,
    replica,
    async ping() {
      try {
        await primaryPool.query('select 1');
        return true;
      } catch {
        return false;
      }
    },
    async close() {
      await primaryPool.end();
      if (replicaPool !== primaryPool) await replicaPool.end();
    },
  };
}
