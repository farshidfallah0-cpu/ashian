import type { Database, DbClient } from '@ashian/db';
import { and, count, desc, eq, exists, ilike, isNull, schema, sql } from '@ashian/db';
import type { DealType, PropertyType } from '@ashian/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { toPage, type Page } from '../common/pipes.js';
import { DB } from '../infra/tokens.js';
import { LocationsService } from '../locations/locations.service.js';

const { agents, users, agencies, listings } = schema;

export interface AgentDto {
  id: string;
  name: string;
  avatarKey: string | null;
  bio: string | null;
  languages: string[];
  areaIds: string[];
  /** نام و slug محله‌های فعالیت */
  areas: Array<{ id: string; slug: string; nameFa: string }>;
  agency: { id: string; name: string; slug: string; logoKey: string | null } | null;
  rating: number | null;
  reviewCount: number;
  avgResponseMinutes: number | null;
  isTopAgent: boolean;
  isVerified: boolean;
  activeListingCount: number;
}

export interface AgentProfile extends AgentDto {
  joinedAt: string;
  /** تخصص: تعداد آگهی فعال به تفکیک نوع معامله و نوع ملک */
  deals: Array<{ dealType: DealType; count: number }>;
  propertyTypes: Array<{ propertyType: PropertyType; count: number }>;
}

/**
 * شماره‌ی مشاور در پاسخ عمومی نیست؛ تماس و واتساپ از مسیر ثبت lead انجام می‌شود
 * تا هم آمار تماس دقیق باشد و هم شماره‌ها به‌صورت انبوه جمع نشوند.
 */
const columns = {
  id: agents.id,
  name: users.name,
  avatarKey: users.avatarKey,
  bio: agents.bio,
  languages: agents.languages,
  areaIds: agents.areaIds,
  agencyId: agencies.id,
  agencyName: agencies.name,
  agencySlug: agencies.slug,
  agencyLogo: agencies.logoKey,
  rating: agents.rating,
  reviewCount: agents.reviewCount,
  avgResponseMinutes: agents.avgResponseMinutes,
  isTopAgent: agents.isTopAgent,
  verificationStatus: agents.verificationStatus,
  activeListingCount: agents.activeListingCount,
  createdAt: agents.createdAt,
};

export const agentBaseQuery = (db: Database) =>
  db
    .select(columns)
    .from(agents)
    .innerJoin(users, eq(users.id, agents.userId))
    .leftJoin(agencies, eq(agencies.id, agents.agencyId));

type Row = Awaited<ReturnType<ReturnType<typeof agentBaseQuery>['limit']>>[number];
type AreaMap = Map<string, { id: string; slug: string; nameFa: string }>;

export interface AgentListQuery {
  q?: string;
  communityId?: string;
  dealType?: DealType;
  propertyType?: PropertyType;
  language?: string;
  agencyId?: string;
  sort?: 'top' | 'listings' | 'rating';
  page: number;
  pageSize: number;
}

@Injectable()
export class AgentsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly locationsService: LocationsService,
  ) {}

  async areaMap(): Promise<AreaMap> {
    const communities = await this.locationsService.list({ type: 'community' });
    return new Map(communities.map((c) => [c.id, { id: c.id, slug: c.slug, nameFa: c.nameFa }]));
  }

  toDto(r: Row, areas: AreaMap): AgentDto {
    return {
      id: r.id,
      name: r.name ?? 'مشاور',
      avatarKey: r.avatarKey,
      bio: r.bio,
      languages: r.languages,
      areaIds: r.areaIds,
      areas: r.areaIds.flatMap((id) => (areas.has(id) ? [areas.get(id)!] : [])),
      agency: r.agencyId
        ? { id: r.agencyId, name: r.agencyName!, slug: r.agencySlug!, logoKey: r.agencyLogo }
        : null,
      rating: r.rating,
      reviewCount: r.reviewCount,
      avgResponseMinutes: r.avgResponseMinutes,
      isTopAgent: r.isTopAgent,
      isVerified: r.verificationStatus === 'verified',
      activeListingCount: r.activeListingCount,
    };
  }

  /** فیلتر «تخصص»: مشاور باید آگهی فعالی با همان ویژگی داشته باشد */
  private hasActive(extra: ReturnType<typeof eq>) {
    return exists(
      this.db.replica
        .select({ one: sql`1` })
        .from(listings)
        .where(
          and(
            eq(listings.agentId, agents.id),
            eq(listings.status, 'active'),
            isNull(listings.deletedAt),
            extra,
          ),
        ),
    );
  }

  async list(query: AgentListQuery): Promise<Page<AgentDto>> {
    const where = and(
      isNull(agents.deletedAt),
      eq(agents.verificationStatus, 'verified'),
      query.communityId ? sql`${query.communityId}::uuid = ANY(${agents.areaIds})` : undefined,
      query.language ? sql`${query.language} = ANY(${agents.languages})` : undefined,
      query.agencyId ? eq(agents.agencyId, query.agencyId) : undefined,
      query.q ? ilike(users.name, `%${query.q.replace(/[%_\\]/g, '')}%`) : undefined,
      query.dealType ? this.hasActive(eq(listings.dealType, query.dealType)) : undefined,
      query.propertyType ? this.hasActive(eq(listings.propertyType, query.propertyType)) : undefined,
    );
    const order =
      query.sort === 'listings'
        ? [desc(agents.activeListingCount), desc(agents.isTopAgent)]
        : query.sort === 'rating'
          ? [desc(sql`coalesce(${agents.rating}, 0)`), desc(agents.reviewCount)]
          : // مشاور برتر اول، بعد امتیاز و تعداد نظر
            [
              desc(agents.isTopAgent),
              desc(sql`coalesce(${agents.rating}, 0)`),
              desc(agents.reviewCount),
            ];

    const [rows, [total], areas] = await Promise.all([
      agentBaseQuery(this.db.replica)
        .where(where)
        .orderBy(...order)
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db.replica
        .select({ n: count() })
        .from(agents)
        .innerJoin(users, eq(users.id, agents.userId))
        .where(where),
      this.areaMap(),
    ]);
    return toPage(
      rows.map((r) => this.toDto(r, areas)),
      total?.n ?? 0,
      query.page,
      query.pageSize,
    );
  }

  async get(id: string): Promise<AgentProfile> {
    const [row] = await agentBaseQuery(this.db.replica)
      .where(and(eq(agents.id, id), isNull(agents.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('مشاور پیدا نشد');
    const active = and(
      eq(listings.agentId, id),
      eq(listings.status, 'active'),
      isNull(listings.deletedAt),
    );
    const [areas, deals, types] = await Promise.all([
      this.areaMap(),
      this.db.replica
        .select({ dealType: listings.dealType, n: count() })
        .from(listings)
        .where(active)
        .groupBy(listings.dealType),
      this.db.replica
        .select({ propertyType: listings.propertyType, n: count() })
        .from(listings)
        .where(active)
        .groupBy(listings.propertyType),
    ]);
    return {
      ...this.toDto(row, areas),
      joinedAt: row.createdAt.toISOString(),
      deals: deals.map((d) => ({ dealType: d.dealType, count: d.n })).sort((a, b) => b.count - a.count),
      propertyTypes: types
        .map((t) => ({ propertyType: t.propertyType, count: t.n }))
        .sort((a, b) => b.count - a.count),
    };
  }
}
