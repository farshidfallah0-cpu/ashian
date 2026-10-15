/**
 * سرور دیتابیس حالت lite: PGlite (همان PostgreSQL، تعبیه‌شده) + PostGIS
 * که روی پروتکل استاندارد Postgres در دسترس است. API و worker مثل یک
 * Postgres واقعی به آن وصل می‌شوند، پس کد هیچ فرقی بین دو حالت ندارد.
 */
import { mkdirSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { postgis } from '@electric-sql/pglite-postgis';
import { createLiteServer } from './lite-protocol-server.js';
import {
  findRepoRoot,
  loadRootEnv,
  parseEnv,
  baseEnvSchema,
  databaseEnvSchema,
} from '@ashian/shared/env';

loadRootEnv();
const env = parseEnv(baseEnvSchema.extend(databaseEnvSchema.shape));

if (env.INFRA_MODE !== 'lite') {
  console.warn('[lite-db] INFRA_MODE=full است؛ سرور lite اجرا نمی‌شود.');
  // پروسه را زنده نگه می‌داریم تا turbo dev آن را خطا حساب نکند
  setInterval(() => {}, 1 << 30);
} else {
  const url = new URL(env.DATABASE_URL);
  const port = Number(url.port || 5432);
  const host = url.hostname === 'localhost' ? '127.0.0.1' : url.hostname;

  const root = findRepoRoot();
  const dataDir = isAbsolute(env.LITE_DB_DIR) ? env.LITE_DB_DIR : join(root, env.LITE_DB_DIR);
  mkdirSync(dataDir, { recursive: true });

  const db = await PGlite.create({ dataDir, extensions: { postgis } });
  await db.exec('CREATE EXTENSION IF NOT EXISTS postgis;');

  const server = createLiteServer(db, { host, port });
  await server.start();
  console.warn(`[lite-db] PGlite + PostGIS روی ${host}:${port} — داده: ${dataDir}`);

  const shutdown = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
