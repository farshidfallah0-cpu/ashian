import type { DbClient } from '@ashian/db';
import { createDocLoader } from './load.js';
import type { SearchEngine } from './types.js';

export interface IndexerLogger {
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
}

/** هر بار از پیش از شروع reindex این‌قدر عقب‌تر می‌رویم تا تغییرهای هم‌زمان با لحظه‌ی شروع هم جبران شوند */
const CATCH_UP_MARGIN_MS = 10_000;

/**
 * هماهنگ‌کننده‌ی نوشتن در ایندکس: همگام‌سازی چند آگهی و ساخت دوباره‌ی کامل.
 * هر دو idempotent‌اند؛ همیشه وضعیت «فعلی» دیتابیس خوانده می‌شود، نه داده‌ی داخل job،
 * پس ترتیب اجرای jobها مهم نیست.
 */
export function createIndexer(deps: { db: DbClient; engine: SearchEngine; logger: IndexerLogger }) {
  const { db, engine, logger } = deps;
  const loader = createDocLoader(db);

  return {
    async syncListings(listingIds: string[]) {
      const { docs, removedIds } = await loader.byIds(listingIds);
      await engine.upsertListings(docs);
      await engine.removeListings(removedIds);
      return { upserted: docs.length, removed: removedIds.length };
    },

    /**
     * ساخت ایندکس تازه از صفر و جابه‌جایی اتمیک. جستجو در تمام مدت از ایندکس قبلی جواب می‌دهد.
     * بعد از جابه‌جایی، آگهی‌هایی که حین ساخت تغییر کرده‌اند دوباره همگام می‌شوند.
     */
    async reindex() {
      const started = Date.now();
      const since = new Date(started - CATCH_UP_MARGIN_MS);
      await engine.ensureReady();
      const session = await engine.beginReindex();

      let listings = 0;
      try {
        for await (const batch of loader.batches()) {
          await session.addListings(batch.docs);
          listings += batch.docs.length;
        }
        const suggestions = await loader.suggestions();
        await session.addSuggestions(suggestions);
        await session.commit();

        let caughtUp = 0;
        for await (const batch of loader.batches({ changedSince: since })) {
          await engine.upsertListings(batch.docs);
          await engine.removeListings(batch.removedIds);
          caughtUp += batch.docs.length + batch.removedIds.length;
        }
        const result = {
          listings,
          suggestions: suggestions.length,
          caughtUp,
          ms: Date.now() - started,
        };
        logger.info(result, 'reindex کامل شد');
        return result;
      } catch (error) {
        await session
          .abort()
          .catch((abortError: unknown) =>
            logger.warn({ err: String(abortError) }, 'پاک‌سازی ایندکس نیمه‌کاره ناموفق بود'),
          );
        throw error;
      }
    },

    async refreshSuggestions() {
      const docs = await loader.suggestions();
      await engine.replaceSuggestions(docs);
      return { suggestions: docs.length };
    },
  };
}

export type Indexer = ReturnType<typeof createIndexer>;
