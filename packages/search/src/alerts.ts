import type { DbClient } from '@ashian/db';
import { and, asc, eq, gt, inArray, lt, ne, schema } from '@ashian/db';
import type { Cache, JobHandlers, QueueClient } from '@ashian/infra';
import {
  LABELS,
  formatNumber,
  formatPrice,
  searchQuerySchema,
  type AlertChannel,
  type AlertFrequency,
  type SearchCard,
} from '@ashian/shared';
import type { Indexer, IndexerLogger } from './indexer.js';
import { SearchService } from './service.js';
import type { SearchEngine } from './types.js';

const { savedSearches, users, notifications, listings } = schema;

const HOUR_MS = 3_600_000;
/** کمی کمتر از دوره تا اجرای دقیقاً سرِ ساعت به دوره‌ی بعد نیفتد */
const MIN_GAP_MS: Record<Exclude<AlertFrequency, 'none'>, number> = {
  instant: 0,
  daily: 23 * HOUR_MS,
  weekly: 6.9 * 24 * HOUR_MS,
};
const BATCH_SIZE = 200;
/** سقف جستجوی یک اجرا؛ بقیه در اجرای بعدی می‌آیند */
const MAX_SEARCHES_PER_RUN = 5_000;
const ITEMS_PER_SEARCH = 20;
const PREVIEW_ITEMS = 3;

/** ارسال خارج از سایت. ارائه‌دهنده‌ی واقعی (SMS/ایمیل) در production جایگزین می‌شود. */
export interface AlertNotifier {
  sms(phone: string, text: string): Promise<void>;
  email(to: string, subject: string, text: string): Promise<void>;
}

/** فقط توسعه: به‌جای ارسال واقعی، در لاگ می‌نویسد */
export function consoleNotifier(logger: IndexerLogger): AlertNotifier {
  return {
    async sms(phone, text) {
      logger.info({ to: `+${phone}` }, `پیامک هشدار: ${text}`);
    },
    async email(to, subject, text) {
      logger.info({ to }, `ایمیل هشدار «${subject}»: ${text}`);
    },
  };
}

/** آیا این جستجو طبق تناوبش وقت هشدار دارد؟ (instant هر بار؛ بقیه بعد از فاصله‌ی حداقلی از آخرین اعلان) */
export function isDue(
  frequency: AlertFrequency,
  lastNotifiedAt: Date | null,
  now: number,
): boolean {
  if (frequency === 'none') return false;
  if (!lastNotifiedAt) return true;
  return now - lastNotifiedAt.getTime() >= MIN_GAP_MS[frequency];
}

/** آگهی‌هایی که بعد از `since` منتشر شده‌اند (بدون تکرار) */
export function newerThan(items: SearchCard[], since: Date): SearchCard[] {
  const t = since.getTime();
  return items.filter((i) => i.publishedAt && new Date(i.publishedAt).getTime() > t);
}

export function alertText(name: string, count: number, link: string): string {
  const n = count >= ITEMS_PER_SEARCH ? `بیش از ${formatNumber(ITEMS_PER_SEARCH - 1, 0)}` : formatNumber(count, 0);
  return `آشیان: ${n} آگهی تازه برای جستجوی «${name}». ${link}`;
}

export interface AlertDeps {
  db: DbClient;
  engine: SearchEngine;
  notifier: AlertNotifier;
  logger: IndexerLogger;
  /** نشانی عمومی وب برای لینک‌ها */
  siteUrl: string;
  /** برای همگام‌سازی آگهی‌هایی که ارتقای «ویژه»شان تمام شده */
  indexer?: Pick<Indexer, 'syncListings'>;
  now?: () => number;
}

/** کش بی‌اثر: نتیجه‌ی هشدار باید همیشه تازه باشد (تکرار فقط داخل یک اجرا حذف می‌شود) */
const noCache = { wrap: (_k: string, _t: number, load: () => Promise<unknown>) => load() } as unknown as Cache;

/**
 * job هشدار جستجوهای ذخیره‌شده. به‌صورت دسته‌ای (keyset، ۲۰۰ تایی)، با یک جستجو به ازای هر
 * query یکتا در اجرا، یک insert دسته‌ای برای اعلان‌ها و یک update برای زمان آخرین اعلان.
 * به موتور جستجو نیاز دارد، پس در همان پروسه‌ای اجرا می‌شود که موتور را دارد (lite: API، full: worker).
 */
export function alertJobs(deps: AlertDeps): JobHandlers {
  const { db, engine, notifier, logger, siteUrl } = deps;
  const clock = deps.now ?? Date.now;
  const search = new SearchService({ engine, cache: noCache });

  return {
    'notifications.run-alerts': async () => {
      const now = clock();
      const nowDate = new Date(now);
      const resultByQs = new Map<string, SearchCard[] | null>();
      const stats = { searches: 0, notified: 0, sent: { push: 0, email: 0, sms: 0 } };
      let cursor: string | null = null;

      while (stats.searches < MAX_SEARCHES_PER_RUN) {
        const batch = await db.primary
          .select()
          .from(savedSearches)
          .where(
            and(
              ne(savedSearches.frequency, 'none'),
              cursor ? gt(savedSearches.id, cursor) : undefined,
            ),
          )
          .orderBy(asc(savedSearches.id))
          .limit(BATCH_SIZE);
        if (batch.length === 0) break;
        cursor = batch[batch.length - 1]!.id;
        stats.searches += batch.length;

        const due = batch.filter((s) => isDue(s.frequency, s.lastNotifiedAt, now));
        if (due.length === 0) continue;

        const hits: Array<{ saved: (typeof due)[number]; items: SearchCard[] }> = [];
        for (const saved of due) {
          const qs = String((saved.query as { qs?: string }).qs ?? '');
          if (!resultByQs.has(qs)) {
            const parsed = searchQuerySchema.safeParse({
              ...Object.fromEntries(new URLSearchParams(qs)),
              sort: 'newest',
              pageSize: ITEMS_PER_SEARCH,
              page: 1,
              facets: false,
            });
            resultByQs.set(
              qs,
              parsed.success ? (await search.searchListings(parsed.data)).items : null,
            );
          }
          const items = resultByQs.get(qs);
          if (!items) continue;
          const since = saved.lastNotifiedAt ?? saved.createdAt;
          const fresh = newerThan(items, since);
          if (fresh.length > 0) hits.push({ saved, items: fresh });
        }
        if (hits.length === 0) continue;

        const owners = await db.primary
          .select({ id: users.id, phone: users.phone, email: users.email, status: users.status })
          .from(users)
          .where(inArray(users.id, [...new Set(hits.map((h) => h.saved.userId))]));
        const ownerById = new Map(owners.map((o) => [o.id, o]));

        const rows: Array<typeof notifications.$inferInsert> = [];
        const notifiedIds: string[] = [];
        for (const { saved, items } of hits) {
          const owner = ownerById.get(saved.userId);
          if (!owner || owner.status === 'blocked') continue;
          const qs = String((saved.query as { qs?: string }).qs ?? '');
          const link = `${siteUrl}/search?${qs}${qs ? '&' : ''}sort=newest`;
          const channels = saved.channels as AlertChannel[];
          notifiedIds.push(saved.id);

          if (channels.includes('push')) {
            rows.push({
              userId: saved.userId,
              type: 'saved-search',
              payload: {
                savedSearchId: saved.id,
                name: saved.name,
                count: items.length,
                query: qs,
                listings: items.slice(0, PREVIEW_ITEMS).map((i) => ({
                  publicId: i.publicId,
                  title: i.title,
                  price: formatPrice(i.price),
                  deal: LABELS.dealType[i.dealType],
                })),
              },
            });
            stats.sent.push++;
          }
          const text = alertText(saved.name, items.length, link);
          try {
            if (channels.includes('sms')) {
              await notifier.sms(owner.phone, text);
              stats.sent.sms++;
            }
            if (channels.includes('email') && owner.email) {
              await notifier.email(owner.email, `آگهی تازه برای «${saved.name}»`, text);
              stats.sent.email++;
            }
          } catch (error) {
            // خرابی ارسال یک کانال نباید بقیه‌ی هشدارها را متوقف کند
            logger.warn({ err: String(error), savedSearchId: saved.id }, 'ارسال هشدار ناموفق بود');
          }
        }

        if (rows.length > 0) await db.primary.insert(notifications).values(rows);
        if (notifiedIds.length > 0) {
          await db.primary
            .update(savedSearches)
            .set({ lastNotifiedAt: nowDate })
            .where(inArray(savedSearches.id, notifiedIds));
        }
        stats.notified += notifiedIds.length;
      }

      // هم‌زمان با هر دور: ارتقای «ویژه»ی تمام‌شده برداشته می‌شود (تا reindex لازم نباشد)
      const expired = await db.primary
        .update(listings)
        .set({ tier: 'standard' })
        .where(and(eq(listings.tier, 'featured'), lt(listings.featuredUntil, nowDate)))
        .returning({ id: listings.id });
      if (expired.length > 0) {
        await deps.indexer?.syncListings(expired.map((e) => e.id));
        logger.info({ count: expired.length }, 'ارتقای ویژه‌ی تمام‌شده برداشته شد');
      }

      if (stats.notified > 0) logger.info(stats, 'هشدار جستجوهای ذخیره‌شده ارسال شد');
      return { ...stats, featuredExpired: expired.length };
    },
  };
}

/**
 * زمان‌بند ساده: هر `intervalSeconds` یک job بررسی هشدار صف می‌کند. jobId هر بازه یکتاست، پس چند
 * نمونه‌ی API/worker همزمان فقط یک job می‌سازند. job تأخیری (delay) عمداً استفاده نمی‌شود (lite).
 */
export function startAlertScheduler(options: {
  queue: QueueClient;
  intervalSeconds: number;
  logger: IndexerLogger;
}): () => void {
  const { queue, intervalSeconds, logger } = options;
  const tick = async () => {
    const bucket = String(Math.floor(Date.now() / (intervalSeconds * 1000)));
    try {
      await queue.enqueue(
        'notifications.run-alerts',
        { tick: bucket },
        { jobId: `alerts-${bucket}`, attempts: 1, removeOnComplete: true, removeOnFail: true },
      );
    } catch (error) {
      logger.warn({ err: String(error) }, 'صف کردن بررسی هشدار ناموفق بود');
    }
  };
  const timer = setInterval(() => void tick(), intervalSeconds * 1000);
  timer.unref();
  return () => clearInterval(timer);
}