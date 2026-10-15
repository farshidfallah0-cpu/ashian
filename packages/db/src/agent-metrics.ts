import { sql } from 'drizzle-orm';
import type { DbClient } from './client.js';

export interface AgentMetricsRow {
  agentId: string;
  verified: boolean;
  rating: number | null;
  reviewCount: number;
  activeListings: number;
  avgQuality: number | null;
  /** null = پاسخی ثبت نشده */
  avgResponseMinutes: number | null;
  violations: number;
}

const WINDOW_RESPONSE_DAYS = 90;
const WINDOW_VIOLATION_DAYS = 180;

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

/**
 * شاخص‌های نشان «مشاور برتر» برای یک یا همه‌ی مشاوران. هم داشبورد (نمایش «چه چیزی کم دارم؟»)
 * و هم job دوره‌ای worker از همین یک کوئری استفاده می‌کنند تا هر دو یک عدد ببینند.
 */
export async function computeAgentMetrics(
  db: DbClient,
  agentIds?: string[],
): Promise<AgentMetricsRow[]> {
  const filter = agentIds?.length
    ? sql`AND a.id IN (${sql.join(
        agentIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`
    : sql``;
  const result = await db.primary.execute<{
    agent_id: string;
    verified: boolean;
    rating: string | number | null;
    review_count: number;
    active_listings: number | string;
    avg_quality: string | number | null;
    avg_response: string | number | null;
    violations: number | string;
  }>(sql`
    SELECT a.id AS agent_id,
      (a.verification_status = 'verified') AS verified,
      a.rating, a.review_count,
      (SELECT count(*) FROM listings l
         WHERE l.agent_id = a.id AND l.status = 'active' AND l.deleted_at IS NULL) AS active_listings,
      (SELECT avg(l.quality_score) FROM listings l
         WHERE l.agent_id = a.id AND l.status = 'active' AND l.deleted_at IS NULL) AS avg_quality,
      (SELECT avg(extract(epoch FROM (ld.first_response_at - ld.created_at)) / 60) FROM leads ld
         WHERE ld.agent_id = a.id AND ld.first_response_at IS NOT NULL
           AND ld.created_at > now() - make_interval(days => ${WINDOW_RESPONSE_DAYS})) AS avg_response,
      (SELECT count(*) FROM reports r JOIN listings l2 ON l2.id = r.listing_id
         WHERE l2.agent_id = a.id AND r.reason = 'fraud' AND r.status = 'resolved'
           AND r.created_at > now() - make_interval(days => ${WINDOW_VIOLATION_DAYS})) AS violations
    FROM agents a
    WHERE a.deleted_at IS NULL ${filter}`);
  return result.rows.map((r) => ({
    agentId: r.agent_id,
    verified: r.verified,
    rating: num(r.rating),
    reviewCount: Number(r.review_count),
    activeListings: Number(r.active_listings),
    avgQuality: num(r.avg_quality),
    avgResponseMinutes: num(r.avg_response) === null ? null : Math.round(num(r.avg_response)!),
    violations: Number(r.violations),
  }));
}