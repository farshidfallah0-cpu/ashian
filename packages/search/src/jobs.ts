import type { JobHandlers } from '@ashian/infra';
import type { Indexer, IndexerLogger } from './indexer.js';

/**
 * پیشنهادهای خودکار فقط «تعداد آگهی» را نشان می‌دهند و کمی کهنه بودنشان مهم نیست؛
 * پس بازسازی‌شان حداکثر دقیقه‌ای یک بار و در همان پروسه‌ای که sync را انجام می‌دهد اجرا می‌شود.
 * (عمداً job با تأخیر (delayed) نیست: در حالت lite صف روی PostgreSQL است و job تأخیری
 * بیدارشدن مصرف‌کننده را تا زمان سررسیدش عقب می‌اندازد و همگام‌سازی آگهی‌ها را کند می‌کند.)
 */
const SUGGESTION_REFRESH_INTERVAL_MS = 60_000;

export interface SearchJobDeps {
  indexer: Indexer;
  logger: IndexerLogger;
  now?: () => number;
}

/**
 * handlerهای صف search. در حالت full توسط worker اجرا می‌شود؛
 * در حالت lite ایندکس درون‌حافظه است و فقط خود API می‌تواند آن را به‌روز کند، پس API این‌ها را اجرا می‌کند.
 */
export function searchJobs({ indexer, logger, now = Date.now }: SearchJobDeps): JobHandlers {
  let lastSuggestionRefresh = 0;

  return {
    'search.sync-listing': async ({ listingId }) => {
      const result = await indexer.syncListings([listingId]);
      logger.info({ listingId, ...result }, 'آگهی همگام شد');

      if (now() - lastSuggestionRefresh >= SUGGESTION_REFRESH_INTERVAL_MS) {
        lastSuggestionRefresh = now();
        try {
          await indexer.refreshSuggestions();
        } catch (error) {
          // تعداد آگهی در پیشنهادها کمی کهنه می‌ماند؛ reindex شبانه جبران می‌کند
          logger.warn({ err: String(error) }, 'بازسازی پیشنهادها ناموفق بود');
        }
      }
      return result;
    },

    'search.reindex': async ({ reason }) => {
      logger.info({ reason }, 'reindex شروع شد');
      return indexer.reindex();
    },

    'search.refresh-suggestions': async () => indexer.refreshSuggestions(),
  };
}
