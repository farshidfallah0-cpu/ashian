import type { DbClient } from '@ashian/db';
import { and, eq, schema, sql } from '@ashian/db';
import {
  processAndStoreImage,
  type JobHandlers,
  type ObjectStorage,
  type QueueClient,
} from '@ashian/infra';
import type { Logger } from '../logger.js';

const { listingMedia, listings } = schema;

/**
 * پردازش عکس آپلودشده: همه‌ی اندازه‌ها (AVIF و WebP)، blurhash، و حذف EXIF (شامل GPS).
 * فایل اصلی بعد از موفقیت پاک می‌شود تا داده‌ی خصوصی کاربر نگه داشته نشود.
 */
export function mediaJobs(deps: {
  db: DbClient;
  storage: ObjectStorage;
  queue: QueueClient;
  logger: Logger;
}): JobHandlers {
  const { db, storage, queue, logger } = deps;

  return {
    'media.process': async ({ mediaId }, job) => {
      const [media] = await db.primary
        .select()
        .from(listingMedia)
        .where(eq(listingMedia.id, mediaId))
        .limit(1);
      if (!media) {
        logger.warn({ mediaId }, 'رسانه حذف شده؛ job رد شد');
        return { skipped: true };
      }
      if (media.status === 'ready') return { skipped: true };

      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      try {
        const original = await storage.get(media.originalKey);
        if (!original) throw new Error('فایل اصلی در ذخیره‌سازی پیدا نشد');

        const started = Date.now();
        const result = await processAndStoreImage(
          storage,
          original,
          `listings/${media.listingId}/${media.id}`,
        );

        await db.primary
          .update(listingMedia)
          .set({
            status: 'ready',
            variants: result.variants,
            width: result.width,
            height: result.height,
            blurhash: result.blurhash,
            phash: result.phash,
          })
          .where(eq(listingMedia.id, media.id));

        // شمارنده‌ی عکس‌های آماده‌ی آگهی (برای رتبه‌بندی و شرط ارسال)
        await db.primary
          .update(listings)
          .set({
            photoCount: sql`(SELECT count(*) FROM listing_media m WHERE m.listing_id = ${listings.id} AND m.status = 'ready' AND m.kind = 'image')`,
          })
          .where(eq(listings.id, media.listingId));

        // عکس تازه به آگهی‌ای که الان در جستجو هست اضافه شده: کارت و رتبه‌اش عوض می‌شود
        const [owner] = await db.primary
          .select({ status: listings.status })
          .from(listings)
          .where(eq(listings.id, media.listingId))
          .limit(1);
        if (owner?.status === 'active') {
          await queue.enqueue(
            'search.sync-listing',
            { listingId: media.listingId },
            { attempts: 5, removeOnComplete: true },
          );
        }

        await storage.delete(media.originalKey);
        logger.info(
          { mediaId, ms: Date.now() - started, w: result.width, h: result.height },
          'عکس پردازش شد',
        );
        return { ok: true };
      } catch (error) {
        // فقط بعد از آخرین تلاش «ناموفق» علامت می‌خورد؛ تلاش‌های قبلی ممکن است موفق شوند
        if (isLastAttempt) {
          await db.primary
            .update(listingMedia)
            .set({ status: 'failed' })
            .where(and(eq(listingMedia.id, media.id), eq(listingMedia.status, 'processing')));
        }
        throw error;
      }
    },
  };
}
