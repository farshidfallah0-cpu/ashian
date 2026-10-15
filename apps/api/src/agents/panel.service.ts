import { randomBytes } from 'node:crypto';
import type { DbClient } from '@ashian/db';
import { and, count, desc, eq, inArray, isNull, schema, sql, computeAgentMetrics } from '@ashian/db';
import {
  topAgentGaps,
  type AgencyOverview,
  type AgentDashboard,
  type CreateAgencyInput,
  type Dashboard,
  type InboxLead,
  type JoinAgentInput,
  type LeadStatus,
  type LeadType,
  type PanelMe,
  type TeamMemberStats,
  type UpdateAgencyInput,
  type UpdateAgentProfileInput,
} from '@ashian/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { toPage, type Page } from '../common/pipes.js';
import { DB } from '../infra/tokens.js';

const { agents, agencies, users, leads, listings, notifications } = schema;

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

const ids = (list: string[]) =>
  sql.join(
    list.map((id) => sql`${id}::uuid`),
    sql`, `,
  );

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

interface PanelContext {
  agent: typeof agents.$inferSelect | null;
  agency: typeof agencies.$inferSelect | null;
}

/**
 * پنل مشاور و آژانس. دسترسی از روی دیتابیس تعیین می‌شود (نه نقش داخل توکن) تا بعد از «پیوستن»
 * یا ساخت آژانس فوراً کار کند. مشاور فقط سرنخ و آگهی خودش را می‌بیند؛ مدیر آژانس تجمیع تیم را.
 */
@Injectable()
export class PanelService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  /* ───────────── هویت و ثبت‌نام ───────────── */

  private async context(userId: string): Promise<PanelContext> {
    const [[agent], [agency]] = await Promise.all([
      this.db.primary
        .select()
        .from(agents)
        .where(and(eq(agents.userId, userId), isNull(agents.deletedAt)))
        .limit(1),
      this.db.primary
        .select()
        .from(agencies)
        .where(and(eq(agencies.managerUserId, userId), isNull(agencies.deletedAt)))
        .limit(1),
    ]);
    return { agent: agent ?? null, agency: agency ?? null };
  }

  private async requireAgent(userId: string) {
    const { agent } = await this.context(userId);
    if (!agent) throw new ForbiddenException('ابتدا به‌عنوان مشاور ثبت‌نام کنید');
    return agent;
  }

  private async requireAgency(userId: string) {
    const { agency } = await this.context(userId);
    if (!agency) throw new ForbiddenException('شما مدیر هیچ آژانسی نیستید');
    return agency;
  }

  async me(user: AuthUser): Promise<PanelMe> {
    const { agent, agency } = await this.context(user.id);
    let agentAgency: { id: string; name: string; slug: string } | null = null;
    if (agent?.agencyId) {
      const [row] = await this.db.primary
        .select({ id: agencies.id, name: agencies.name, slug: agencies.slug })
        .from(agencies)
        .where(eq(agencies.id, agent.agencyId))
        .limit(1);
      agentAgency = row ?? null;
    }
    return {
      agent: agent
        ? {
            id: agent.id,
            brn: agent.brn,
            bio: agent.bio,
            languages: agent.languages,
            areaIds: agent.areaIds,
            whatsapp: agent.whatsapp,
            verificationStatus: agent.verificationStatus,
            isTopAgent: agent.isTopAgent,
            agency: agentAgency,
          }
        : null,
      managedAgency: agency
        ? {
            id: agency.id,
            name: agency.name,
            slug: agency.slug,
            verificationStatus: agency.verificationStatus,
          }
        : null,
    };
  }

  async join(user: AuthUser, input: JoinAgentInput) {
    const { agent } = await this.context(user.id);
    if (agent) throw new ConflictException('شما قبلاً به‌عنوان مشاور ثبت‌نام کرده‌اید');
    const [row] = await this.db.primary
      .insert(agents)
      .values({
        userId: user.id,
        brn: input.brn,
        bio: input.bio,
        languages: input.languages,
        areaIds: input.areaIds,
        whatsapp: input.whatsapp,
        // تأیید مجوز (BRN) را تیم آشیان انجام می‌دهد (پنل ادمین، مرحله‌ی ۱۲)
        verificationStatus: 'pending',
      })
      .returning({ id: agents.id });
    if (user.role === 'user') {
      await this.db.primary.update(users).set({ role: 'agent' }).where(eq(users.id, user.id));
    }

    // درخواست پیوستن به آژانس: مدیر آژانس اعلان می‌گیرد و با شماره‌ی مشاور او را به تیم اضافه می‌کند
    if (input.agencySlug) {
      const [target] = await this.db.primary
        .select({ id: agencies.id, managerUserId: agencies.managerUserId })
        .from(agencies)
        .where(and(eq(agencies.slug, input.agencySlug), isNull(agencies.deletedAt)))
        .limit(1);
      if (target?.managerUserId) {
        const [me] = await this.db.primary
          .select({ name: users.name, phone: users.phone })
          .from(users)
          .where(eq(users.id, user.id));
        await this.db.primary.insert(notifications).values({
          userId: target.managerUserId,
          type: 'agency-join-request',
          payload: { agentId: row!.id, name: me?.name ?? null, phone: me?.phone ?? null },
        });
      }
    }
    return { id: row!.id, verificationStatus: 'pending' as const };
  }

  async updateProfile(user: AuthUser, input: UpdateAgentProfileInput) {
    const agent = await this.requireAgent(user.id);
    await this.db.primary
      .update(agents)
      .set({
        ...(input.brn !== undefined ? { brn: input.brn } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.languages !== undefined ? { languages: input.languages } : {}),
        ...(input.areaIds !== undefined ? { areaIds: input.areaIds } : {}),
        ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp } : {}),
        // تغییر BRN دوباره باید تأیید شود
        ...(input.brn !== undefined && input.brn !== agent.brn
          ? { verificationStatus: 'pending' as const }
          : {}),
      })
      .where(eq(agents.id, agent.id));
  }

  /* ───────────── آمار ───────────── */

  private async dashboardFor(agentIds: string[], days: number): Promise<Dashboard> {
    if (agentIds.length === 0) return this.emptyDashboard(days);
    const list = ids(agentIds);
    const [views, leadsRows, top, response, active, newLeads] = await Promise.all([
      this.db.primary.execute<{ day: string; views: number; uniq: number }>(sql`
        SELECT lv.day::text AS day, sum(lv.views)::int AS views, sum(lv.unique_views)::int AS uniq
        FROM listing_views lv JOIN listings l ON l.id = lv.listing_id
        WHERE l.agent_id IN (${list}) AND lv.day >= current_date - ${days}::int
        GROUP BY lv.day`),
      this.db.primary.execute<{ day: string; type: LeadType; n: number }>(sql`
        SELECT created_at::date::text AS day, type, count(*)::int AS n
        FROM leads WHERE agent_id IN (${list}) AND created_at >= now() - make_interval(days => ${days})
        GROUP BY 1, 2`),
      this.db.primary.execute<{ public_id: string; title: string; views: number; leads: number }>(sql`
        SELECT t.public_id, t.title, t.views, t.leads FROM (
          SELECT l.public_id, l.title, l.published_at,
            coalesce((SELECT sum(v.views) FROM listing_views v
              WHERE v.listing_id = l.id AND v.day >= current_date - ${days}::int), 0)::int AS views,
            (SELECT count(*) FROM leads d WHERE d.listing_id = l.id
              AND d.created_at >= now() - make_interval(days => ${days}))::int AS leads
          FROM listings l
          WHERE l.agent_id IN (${list}) AND l.status = 'active' AND l.deleted_at IS NULL
        ) t
        ORDER BY t.views + t.leads * 5 DESC, t.published_at DESC NULLS LAST
        LIMIT 5`),
      this.db.primary.execute<{ avg: string | null }>(sql`
        SELECT avg(extract(epoch FROM (first_response_at - created_at)) / 60) AS avg
        FROM leads WHERE agent_id IN (${list}) AND first_response_at IS NOT NULL
          AND created_at >= now() - interval '90 days'`),
      this.db.primary
        .select({ n: count() })
        .from(listings)
        .where(
          and(
            inArray(listings.agentId, agentIds),
            eq(listings.status, 'active'),
            isNull(listings.deletedAt),
          ),
        ),
      this.db.primary
        .select({ n: count() })
        .from(leads)
        .where(and(inArray(leads.agentId, agentIds), eq(leads.status, 'new'))),
    ]);

    const byDay = new Map<string, { views: number; leads: number }>();
    let totalViews = 0;
    let unique = 0;
    for (const r of views.rows) {
      byDay.set(r.day, { views: Number(r.views), leads: 0 });
      totalViews += Number(r.views);
      unique += Number(r.uniq);
    }
    const leadsByType: Record<LeadType, number> = { call: 0, whatsapp: 0, message: 0, visit_request: 0 };
    let totalLeads = 0;
    for (const r of leadsRows.rows) {
      const point = byDay.get(r.day) ?? { views: 0, leads: 0 };
      point.leads += Number(r.n);
      byDay.set(r.day, point);
      leadsByType[r.type] += Number(r.n);
      totalLeads += Number(r.n);
    }

    const series = Array.from({ length: days }, (_, i) => {
      const day = new Date(Date.now() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
      return { day, views: byDay.get(day)?.views ?? 0, leads: byDay.get(day)?.leads ?? 0 };
    });
    const avg = response.rows[0]?.avg;

    return {
      days,
      kpis: {
        activeListings: active[0]?.n ?? 0,
        views: totalViews,
        uniqueViews: unique,
        leads: totalLeads,
        leadRate: unique > 0 ? Math.round((totalLeads / unique) * 1000) / 10 : null,
        newLeads: newLeads[0]?.n ?? 0,
        avgResponseMinutes: avg === null || avg === undefined ? null : Math.round(Number(avg)),
      },
      series,
      leadsByType,
      topListings: top.rows.map((t) => ({
        publicId: t.public_id,
        title: t.title,
        views: Number(t.views),
        leads: Number(t.leads),
      })),
    };
  }

  private emptyDashboard(days: number): Dashboard {
    return {
      days,
      kpis: { activeListings: 0, views: 0, uniqueViews: 0, leads: 0, leadRate: null, newLeads: 0, avgResponseMinutes: null },
      series: [],
      leadsByType: { call: 0, whatsapp: 0, message: 0, visit_request: 0 },
      topListings: [],
    };
  }

  private clampDays(days: number | undefined) {
    return Math.min(MAX_DAYS, Math.max(7, days ?? DEFAULT_DAYS));
  }

  async dashboard(user: AuthUser, days?: number): Promise<AgentDashboard> {
    const agent = await this.requireAgent(user.id);
    const [dash, [metrics]] = await Promise.all([
      this.dashboardFor([agent.id], this.clampDays(days)),
      computeAgentMetrics(this.db, [agent.id]),
    ]);
    const gaps = metrics
      ? topAgentGaps({
          verified: metrics.verified,
          rating: metrics.rating,
          reviewCount: metrics.reviewCount,
          avgResponseMinutes: metrics.avgResponseMinutes,
          avgQuality: metrics.avgQuality,
          activeListings: metrics.activeListings,
          violations: metrics.violations,
        })
      : [];
    return { ...dash, badge: { isTop: agent.isTopAgent, gaps } };
  }

  /* ───────────── صندوق سرنخ ───────────── */

  /** مشاور: سرنخ‌های خودش؛ همین تابع برای مدیر آژانس با agentIds تیم هم کار می‌کند */
  async leadsFor(
    agentIds: string[],
    opts: { status?: LeadStatus; page: number; pageSize: number },
  ): Promise<Page<InboxLead>> {
    if (agentIds.length === 0) return toPage([], 0, opts.page, opts.pageSize);
    const where = and(
      inArray(leads.agentId, agentIds),
      opts.status ? eq(leads.status, opts.status) : undefined,
    );
    const [rows, [total]] = await Promise.all([
      this.db.primary
        .select({
          id: leads.id,
          type: leads.type,
          status: leads.status,
          name: leads.name,
          phone: leads.phone,
          message: leads.message,
          createdAt: leads.createdAt,
          firstResponseAt: leads.firstResponseAt,
          publicId: listings.publicId,
          title: listings.title,
          code: listings.code,
          agentName: users.name,
        })
        .from(leads)
        .innerJoin(listings, eq(listings.id, leads.listingId))
        .leftJoin(agents, eq(agents.id, leads.agentId))
        .leftJoin(users, eq(users.id, agents.userId))
        .where(where)
        .orderBy(desc(leads.createdAt))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize),
      this.db.primary.select({ n: count() }).from(leads).where(where),
    ]);
    return toPage(
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        name: r.name,
        phone: r.phone,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
        firstResponseAt: r.firstResponseAt?.toISOString() ?? null,
        listing: { publicId: r.publicId, title: r.title, code: r.code },
        agentName: r.agentName,
      })),
      total?.n ?? 0,
      opts.page,
      opts.pageSize,
    );
  }

  async myLeads(user: AuthUser, opts: { status?: LeadStatus; page: number; pageSize: number }) {
    const agent = await this.requireAgent(user.id);
    return this.leadsFor([agent.id], opts);
  }

  /** وضعیت سرنخ: اولین خروج از «جدید» زمان پاسخ را ثبت می‌کند (برای میانگین زمان پاسخ و نشان مشاور برتر) */
  async setLeadStatus(user: AuthUser, leadId: string, status: LeadStatus) {
    const { agent, agency } = await this.context(user.id);
    const allowed: string[] = agent ? [agent.id] : [];
    if (agency) {
      const team = await this.db.primary
        .select({ id: agents.id })
        .from(agents)
        .where(eq(agents.agencyId, agency.id));
      allowed.push(...team.map((t) => t.id));
    }
    if (allowed.length === 0) throw new ForbiddenException('دسترسی ندارید');
    const [lead] = await this.db.primary
      .select()
      .from(leads)
      .where(and(eq(leads.id, leadId), inArray(leads.agentId, allowed)))
      .limit(1);
    if (!lead) throw new NotFoundException('سرنخ پیدا نشد');
    await this.db.primary
      .update(leads)
      .set({
        status,
        ...(status !== 'new' && !lead.firstResponseAt ? { firstResponseAt: new Date() } : {}),
      })
      .where(eq(leads.id, leadId));
  }

  /* ───────────── آژانس ───────────── */

  async createAgency(user: AuthUser, input: CreateAgencyInput) {
    const { agency } = await this.context(user.id);
    if (agency) throw new ConflictException('شما قبلاً یک آژانس ساخته‌اید');
    const base = slugify(input.nameEn ?? '') || 'agency';
    for (let attempt = 0; attempt < 5; attempt++) {
      const slug = attempt === 0 && base !== 'agency' ? base : `${base}-${randomBytes(2).toString('hex')}`;
      try {
        const [row] = await this.db.primary
          .insert(agencies)
          .values({
            name: input.name,
            nameEn: input.nameEn,
            slug,
            description: input.description,
            licenseNumber: input.licenseNumber,
            managerUserId: user.id,
            verificationStatus: 'pending',
          })
          .returning({ id: agencies.id, slug: agencies.slug });
        if (user.role === 'user') {
          await this.db.primary.update(users).set({ role: 'agency_manager' }).where(eq(users.id, user.id));
        }
        return row!;
      } catch (error) {
        if ((error as { code?: string }).code !== '23505') throw error;
      }
    }
    throw new ConflictException('ساخت آژانس ناموفق بود؛ دوباره تلاش کنید');
  }

  async updateAgency(user: AuthUser, input: UpdateAgencyInput) {
    const agency = await this.requireAgency(user.id);
    await this.db.primary
      .update(agencies)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.licenseNumber !== undefined
          ? { licenseNumber: input.licenseNumber, verificationStatus: 'pending' as const }
          : {}),
      })
      .where(eq(agencies.id, agency.id));
  }

  async agencyOverview(user: AuthUser, days?: number): Promise<AgencyOverview> {
    const agency = await this.requireAgency(user.id);
    const d = this.clampDays(days);
    const members = await this.db.primary
      .select({
        id: agents.id,
        name: users.name,
        verified: agents.verificationStatus,
        top: agents.isTopAgent,
        active: agents.activeListingCount,
        avgResponse: agents.avgResponseMinutes,
      })
      .from(agents)
      .innerJoin(users, eq(users.id, agents.userId))
      .where(and(eq(agents.agencyId, agency.id), isNull(agents.deletedAt)));
    const memberIds = members.map((m) => m.id);

    const [dash, perAgent] = await Promise.all([
      this.dashboardFor(memberIds, d),
      memberIds.length === 0
        ? Promise.resolve({ rows: [] as Array<{ agent_id: string; views: number; leads: number }> })
        : this.db.primary.execute<{ agent_id: string; views: number; leads: number }>(sql`
            SELECT a.id AS agent_id,
              coalesce((SELECT sum(v.views) FROM listing_views v JOIN listings l ON l.id = v.listing_id
                WHERE l.agent_id = a.id AND v.day >= current_date - ${d}::int), 0)::int AS views,
              (SELECT count(*) FROM leads d WHERE d.agent_id = a.id
                AND d.created_at >= now() - make_interval(days => ${d}))::int AS leads
            FROM agents a WHERE a.id IN (${ids(memberIds)})`),
    ]);
    const stats = new Map(perAgent.rows.map((r) => [r.agent_id, r]));
    const team: TeamMemberStats[] = members
      .map((m) => ({
        agentId: m.id,
        name: m.name ?? 'مشاور',
        isVerified: m.verified === 'verified',
        isTopAgent: m.top,
        activeListings: m.active,
        views: Number(stats.get(m.id)?.views ?? 0),
        leads: Number(stats.get(m.id)?.leads ?? 0),
        avgResponseMinutes: m.avgResponse,
      }))
      .sort((a, b) => b.leads - a.leads || b.views - a.views);

    return {
      agency: {
        id: agency.id,
        name: agency.name,
        nameEn: agency.nameEn,
        slug: agency.slug,
        logoKey: agency.logoKey,
        description: agency.description,
        licenseNumber: agency.licenseNumber,
        isVerified: agency.verificationStatus === 'verified',
        verificationStatus: agency.verificationStatus,
        agentCount: members.length,
        activeListingCount: members.reduce((n, m) => n + m.active, 0),
      },
      dashboard: dash,
      team,
    };
  }

  async agencyLeads(user: AuthUser, opts: { status?: LeadStatus; page: number; pageSize: number }) {
    const agency = await this.requireAgency(user.id);
    const team = await this.db.primary
      .select({ id: agents.id })
      .from(agents)
      .where(eq(agents.agencyId, agency.id));
    return this.leadsFor(
      team.map((t) => t.id),
      opts,
    );
  }

  /** افزودن مشاور به تیم با شماره‌ی موبایل (مشاور باید قبلاً ثبت‌نام کرده و آژانس دیگری نداشته باشد) */
  async addMember(user: AuthUser, phone: string) {
    const agency = await this.requireAgency(user.id);
    const [row] = await this.db.primary
      .select({ agentId: agents.id, agencyId: agents.agencyId })
      .from(users)
      .innerJoin(agents, eq(agents.userId, users.id))
      .where(and(eq(users.phone, phone), isNull(agents.deletedAt)))
      .limit(1);
    if (!row) throw new NotFoundException('مشاوری با این شماره ثبت‌نام نکرده است');
    if (row.agencyId && row.agencyId !== agency.id) {
      throw new ConflictException('این مشاور عضو آژانس دیگری است');
    }
    await this.db.primary.update(agents).set({ agencyId: agency.id }).where(eq(agents.id, row.agentId));
    return { agentId: row.agentId };
  }

  async removeMember(user: AuthUser, agentId: string) {
    const agency = await this.requireAgency(user.id);
    const removed = await this.db.primary
      .update(agents)
      .set({ agencyId: null })
      .where(and(eq(agents.id, agentId), eq(agents.agencyId, agency.id)))
      .returning({ id: agents.id });
    if (removed.length === 0) throw new BadRequestException('این مشاور عضو تیم شما نیست');
  }
}
