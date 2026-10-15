import type { DbClient } from '@ashian/db';
import { computeAgentMetrics, eq, schema, sql } from '@ashian/db';
import { isTopAgent } from '@ashian/shared';
import type { Cache, JobHandlers } from '@ashian/infra';

const { listingViews, agents } = schema;

const BATCH = 200;

/**
 * بازدید آگهی: به‌جای یک نوشتن به ازای هر بازدید، شمارنده‌ی روزانه با upsert افزایش می‌یابد.
 * هش بازدیدکننده در کش (با TTL یک روز) تا بازدید یکتا شمرده شود، بدون ذخیره‌ی IP.
 */
export function analyticsJobs(deps: { db: DbClient; cache: Cache }): JobHandlers {
  const { db, cache } = deps;

  return {
    /**
     * محاسبه‌ی دوره‌ای شاخص‌های مشاوران و نشان «مشاور برتر» (معیارها در @ashian/shared/agent-badge).
     * شمارنده‌ی آگهی فعال و میانگین زمان پاسخ هم همین‌جا به‌روز می‌شود تا کارت‌ها هیچ‌وقت کوئری سنگین نزنند.
     */
    'analytics.refresh-agents': async () => {
      const all = await computeAgentMetrics(db);
      let top = 0;
      for (let i = 0; i < all.length; i += BATCH) {
        await Promise.all(
          all.slice(i, i + BATCH).map((m) => {
            const isTop = isTopAgent({
              verified: m.verified,
              rating: m.rating,
              reviewCount: m.reviewCount,
              avgResponseMinutes: m.avgResponseMinutes,
              avgQuality: m.avgQuality,
              activeListings: m.activeListings,
              violations: m.violations,
            });
            if (isTop) top++;
            return db.primary
              .update(agents)
              .set({
                activeListingCount: m.activeListings,
                isTopAgent: isTop,
                // بدون داده‌ی تازه، مقدار قبلی (مثلاً از seed) حفظ می‌شود
                ...(m.avgResponseMinutes !== null ? { avgResponseMinutes: m.avgResponseMinutes } : {}),
              })
              .where(eq(agents.id, m.agentId));
          }),
        );
      }
      return { agents: all.length, top };
    },

    'analytics.view': async ({ listingId, day, visitorHash }) => {
      const key = `view:${listingId}:${day}:${visitorHash}`;
      const seen = (await cache.get(key)) !== null;
      if (!seen) await cache.set(key, 1, 24 * 3600);

      await db.primary
        .insert(listingViews)
        .values({ listingId, day, views: 1, uniqueViews: seen ? 0 : 1 })
        .onConflictDoUpdate({
          target: [listingViews.listingId, listingViews.day],
          set: {
            views: sql`${listingViews.views} + 1`,
            uniqueViews: sql`${listingViews.uniqueViews} + ${seen ? 0 : 1}`,
          },
        });
    },
  };
}
