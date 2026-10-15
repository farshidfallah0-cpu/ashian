import type { DbClient } from '@ashian/db';
import { and, count, desc, eq, ilike, isNull, schema, sql } from '@ashian/db';
import type { AgencyProfileDto, AgencySummary } from '@ashian/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { toPage, type Page } from '../common/pipes.js';
import { DB } from '../infra/tokens.js';
import { agentBaseQuery, AgentsService } from './agents.service.js';

const { agencies, agents } = schema;

/** آژانس‌های تأییدشده با تعداد مشاور و آگهی فعال (مجموع آگهی‌های مشاورانش) */
@Injectable()
export class AgenciesService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly agentsService: AgentsService,
  ) {}

  private summaryColumns() {
    return {
      id: agencies.id,
      name: agencies.name,
      nameEn: agencies.nameEn,
      slug: agencies.slug,
      logoKey: agencies.logoKey,
      description: agencies.description,
      licenseNumber: agencies.licenseNumber,
      verification: agencies.verificationStatus,
      agentCount: sql<number>`(SELECT count(*) FROM agents a WHERE a.agency_id = ${agencies.id}
        AND a.deleted_at IS NULL AND a.verification_status = 'verified')::int`,
      activeListingCount: sql<number>`coalesce((SELECT sum(a.active_listing_count) FROM agents a
        WHERE a.agency_id = ${agencies.id} AND a.deleted_at IS NULL
        AND a.verification_status = 'verified'), 0)::int`,
    };
  }

  private toSummary(r: {
    id: string;
    name: string;
    nameEn: string | null;
    slug: string;
    logoKey: string | null;
    description: string | null;
    licenseNumber: string | null;
    verification: string;
    agentCount: number;
    activeListingCount: number;
  }): AgencySummary {
    return {
      id: r.id,
      name: r.name,
      nameEn: r.nameEn,
      slug: r.slug,
      logoKey: r.logoKey,
      description: r.description,
      licenseNumber: r.licenseNumber,
      isVerified: r.verification === 'verified',
      agentCount: Number(r.agentCount),
      activeListingCount: Number(r.activeListingCount),
    };
  }

  async list(opts: { q?: string; page: number; pageSize: number }): Promise<Page<AgencySummary>> {
    const where = and(
      isNull(agencies.deletedAt),
      eq(agencies.verificationStatus, 'verified'),
      opts.q ? ilike(agencies.name, `%${opts.q.replace(/[%_\\]/g, '')}%`) : undefined,
    );
    const [rows, [total]] = await Promise.all([
      this.db.replica
        .select(this.summaryColumns())
        .from(agencies)
        .where(where)
        .orderBy(desc(sql`4`), desc(agencies.createdAt))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize),
      this.db.replica.select({ n: count() }).from(agencies).where(where),
    ]);
    // بیشترین آگهی فعال اول
    const items = rows.map((r) => this.toSummary(r)).sort((a, b) => b.activeListingCount - a.activeListingCount);
    return toPage(items, total?.n ?? 0, opts.page, opts.pageSize);
  }

  async get(slug: string): Promise<AgencyProfileDto> {
    const [row] = await this.db.replica
      .select(this.summaryColumns())
      .from(agencies)
      .where(and(eq(agencies.slug, slug), isNull(agencies.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('آژانس پیدا نشد');
    const [teamRows, areaMap] = await Promise.all([
      agentBaseQuery(this.db.replica)
        .where(
          and(
            eq(agents.agencyId, row.id),
            isNull(agents.deletedAt),
            eq(agents.verificationStatus, 'verified'),
          ),
        )
        .orderBy(desc(agents.isTopAgent), desc(agents.activeListingCount)),
      this.agentsService.areaMap(),
    ]);
    const team = teamRows.map((t) => this.agentsService.toDto(t, areaMap));
    // محله‌هایی که تیم در آن فعال است (تعداد مشاور)
    const counts = new Map<string, { slug: string; nameFa: string; count: number }>();
    for (const member of team)
      for (const area of member.areas) {
        const entry = counts.get(area.id) ?? { slug: area.slug, nameFa: area.nameFa, count: 0 };
        entry.count++;
        counts.set(area.id, entry);
      }
    return {
      ...this.toSummary(row),
      team,
      areas: [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 12),
    };
  }
}