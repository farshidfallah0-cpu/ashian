import type { DbClient } from '@ashian/db';
import { and, count, desc, eq, inArray, isNull, schema } from '@ashian/db';
import type { MyLeadDto, NotificationDto } from '@ashian/shared';
import { Inject, Injectable } from '@nestjs/common';
import { toPage, type Page } from '../common/pipes.js';
import { DB } from '../infra/tokens.js';

const { notifications, leads, listings, agents, users } = schema;

@Injectable()
export class AccountService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async notifications(
    userId: string,
    opts: { page: number; pageSize: number; unreadOnly: boolean },
  ): Promise<Page<NotificationDto>> {
    const where = and(
      eq(notifications.userId, userId),
      opts.unreadOnly ? isNull(notifications.readAt) : undefined,
    );
    const [rows, [total]] = await Promise.all([
      this.db.primary
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(opts.pageSize)
        .offset((opts.page - 1) * opts.pageSize),
      this.db.primary.select({ n: count() }).from(notifications).where(where),
    ]);
    return toPage(
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        payload: r.payload,
        readAt: r.readAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      total?.n ?? 0,
      opts.page,
      opts.pageSize,
    );
  }

  async unreadCount(userId: string): Promise<number> {
    const [row] = await this.db.primary
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return row?.n ?? 0;
  }

  /** ids خالی = همه‌ی اعلان‌های خوانده‌نشده */
  async markRead(userId: string, ids?: string[]): Promise<void> {
    await this.db.primary
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
          ids?.length ? inArray(notifications.id, ids) : undefined,
        ),
      );
  }

  /** پیام‌ها و درخواست‌های بازدیدی که این کاربر برای آگهی‌ها فرستاده است */
  async myLeads(userId: string, page: number, pageSize: number): Promise<Page<MyLeadDto>> {
    const where = eq(leads.userId, userId);
    const [rows, [total]] = await Promise.all([
      this.db.primary
        .select({
          id: leads.id,
          type: leads.type,
          status: leads.status,
          message: leads.message,
          createdAt: leads.createdAt,
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
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.primary.select({ n: count() }).from(leads).where(where),
    ]);
    return toPage(
      rows.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        message: r.message,
        createdAt: r.createdAt.toISOString(),
        listing: { publicId: r.publicId, title: r.title, code: r.code },
        agentName: r.agentName,
      })),
      total?.n ?? 0,
      page,
      pageSize,
    );
  }
}