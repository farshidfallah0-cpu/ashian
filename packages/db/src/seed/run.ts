/**
 * seed دیتابیس: `pnpm --filter @ashian/db seed` (یا با --force برای پاک‌سازی و ساخت دوباره)
 * فقط روی دیتابیس خالی اجرا می‌شود مگر --force داده شود.
 * گزینه‌ها: --force  --count=5000
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStorage, infraEnvSchema, processAndStoreImage } from '@ashian/infra';
import { loadRootEnv, parseEnv } from '@ashian/shared/env';
import { sql } from 'drizzle-orm';
import type { PgInsertValue, PgTable } from 'drizzle-orm/pg-core';
import sharp from 'sharp';
import { createDb } from '../client.js';
import { point } from '../geo.js';
import { runMigrations } from '../migrate.js';
import * as s from '../schema/index.js';
import { generateDataset, PLACEHOLDER_COUNT } from './generate.js';
import { PHOTO_POOL } from './photos.js';
import { placeholderSvg } from './images.js';

loadRootEnv();
const env = parseEnv(infraEnvSchema);
const force = process.argv.includes('--force');
const countArg = process.argv.find((a) => a.startsWith('--count='));
const listingCount = countArg ? Number(countArg.split('=')[1]) : 5000;

const log = (msg: string) => console.warn(`[seed] ${msg}`);

/** پوشه‌ی عکس‌های واقعی: packages/db/assets/photos (نسبت به dist/seed/run.js) */
const PHOTOS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'photos');

const dbUrl = process.env.DATABASE_MIGRATE_URL || env.DATABASE_URL;
await runMigrations(dbUrl);
const db = createDb({
  url: dbUrl,
  poolMax: 4,
  applicationName: 'ashian-seed',
});
const pg = db.primary;

const [{ n } = { n: 0 }] = await pg.select({ n: sql<number>`count(*)::int` }).from(s.listings);
if (n > 0 && !force) {
  log(`دیتابیس ${n} آگهی دارد؛ seed رد شد (برای ساخت دوباره: --force).`);
  await db.close();
  process.exit(0);
}
if (force) {
  log('پاک‌سازی داده‌های قبلی…');
  await pg.execute(
    sql`TRUNCATE TABLE users, agencies, locations, amenities RESTART IDENTITY CASCADE`,
  );
}

async function insertChunks<T extends PgTable>(
  table: T,
  rows: Array<PgInsertValue<T>>,
  size = 500,
) {
  for (let i = 0; i < rows.length; i += size) {
    await pg.insert(table).values(rows.slice(i, i + size));
  }
}

const started = Date.now();
log(`ساخت داده (${listingCount} آگهی)…`);
const data = generateDataset({ listingCount });

// ── عکس‌های جای‌نگهدار (یک بار پردازش، بین آگهی‌ها مشترک) ──
log(`ساخت و پردازش ${PLACEHOLDER_COUNT} عکس جای‌نگهدار (AVIF + WebP + blurhash)…`);
const storage = await createStorage(env);
const placeholders = new Array<
  Awaited<ReturnType<typeof processAndStoreImage>> & { source: string }
>(PLACEHOLDER_COUNT);
const indexes = Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => i);
const pool = 3;
await Promise.all(
  Array.from({ length: pool }, async (_, worker) => {
    for (let i = worker; i < indexes.length; i += pool) {
      // عکس واقعی از assets/photos؛ اگر فایل نبود (clone ناقص) SVG جای‌نگهدار
      const file = join(PHOTOS_DIR, `${PHOTO_POOL[i]!.key}.jpg`);
      const jpeg = existsSync(file)
        ? await readFile(file)
        : await sharp(Buffer.from(placeholderSvg(i)))
            .jpeg({ quality: 88 })
            .toBuffer();
      const prefix = `seed/ph-${i}`;
      const source = `${prefix}/source.jpg`;
      await storage.put(source, jpeg, 'image/jpeg');
      placeholders[i] = { ...(await processAndStoreImage(storage, jpeg, prefix)), source };
    }
  }),
);

// ── درج داده ──
log('درج مکان‌ها، امکانات، کاربران و آژانس‌ها…');
await insertChunks(
  s.locations,
  data.locations.map((l) => ({
    id: l.id,
    parentId: l.parentId,
    type: l.type,
    slug: l.slug,
    nameFa: l.nameFa,
    nameEn: l.nameEn,
    aliases: l.aliases,
    path: l.path,
    center: point(l.lng, l.lat),
  })),
);
await insertChunks(s.amenities, data.amenities);
await insertChunks(s.users, data.users);
await insertChunks(s.agencies, data.agencies);
await insertChunks(s.agents, data.agents);

log(`درج ${data.listings.length} آگهی…`);
await insertChunks(
  s.listings,
  data.listings.map(({ lng, lat, ...l }) => ({ ...l, location: point(lng, lat) })),
  400,
);
await insertChunks(s.listingAmenities, data.listingAmenities, 2000);

log(`درج ${data.media.length} رسانه…`);
await insertChunks(
  s.listingMedia,
  data.media.map((m) => {
    const ph = placeholders[m.placeholder]!;
    return {
      id: m.id,
      listingId: m.listingId,
      kind: 'image' as const,
      status: 'ready' as const,
      originalKey: ph.source,
      variants: ph.variants,
      width: ph.width,
      height: ph.height,
      blurhash: ph.blurhash,
      phash: ph.phash,
      position: m.position,
    };
  }),
  1000,
);
await insertChunks(s.priceHistory, data.priceHistory);

await pg.execute(sql`ANALYZE`);
const seconds = ((Date.now() - started) / 1000).toFixed(1);
log(
  `تمام شد در ${seconds} ثانیه: ${data.locations.length} مکان، ${data.agents.length} مشاور، ${data.listings.length} آگهی، ${data.media.length} عکس.`,
);
await db.close();
process.exit(0);
