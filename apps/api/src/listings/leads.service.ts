import type { DbClient } from '@ashian/db';
import { alias, and, eq, isNull, schema } from '@ashian/db';
import type { CreateLeadInput, LeadResponse, ReportListingInput } from '@ashian/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { DB } from '../infra/tokens.js';

const { listings, leads, reports, notifications, agents, users } = schema;
const agentUser = alias(users, 'agent_user');
const ownerUser = alias(users, 'owner_user');

const MIN_MESSAGE_LENGTH = 5;

const digitsOnly = (value: string) => value.replace(/\D/g, '');

/**
 * سرنخ‌ها و گزارش‌های صفحه‌ی آگهی. هر کلیک تماس/واتساپ/پیام/بازدید یک lead ثبت می‌کند
 * و فقط در پاسخ همین درخواست راه تماس را برمی‌گرداند.
 */
@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(@Inject(DB) private readonly db: DbClient) {}

  async createLead(
    publicId: string,
    input: CreateLeadInput,
    viewer: AuthUser | undefined,
  ): Promise<LeadResponse> {
    const [row] = await this.db.primary
      .select({
        id: listings.id,
        code: listings.code,
        title: listings.title,
        ownerId: listings.ownerId,
        agentId: agents.id,
        agentUserId: agentUser.id,
        agentPhone: agentUser.phone,
        agentWhatsapp: agents.whatsapp,
        ownerPhone: ownerUser.phone,
      })
      .from(listings)
      .innerJoin(ownerUser, eq(ownerUser.id, listings.ownerId))
      .leftJoin(agents, eq(agents.id, listings.agentId))
      .leftJoin(agentUser, eq(agentUser.id, agents.userId))
      .where(
        and(
          eq(listings.publicId, publicId),
          eq(listings.status, 'active'),
          isNull(listings.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('آگهی پیدا نشد');

    const recipientUserId = row.agentUserId ?? row.ownerId;
    const phone = row.agentPhone ?? row.ownerPhone;
    const whatsapp = digitsOnly(row.agentWhatsapp ?? phone);

    // پیام و درخواست بازدید: مهمان باید راه تماس بدهد؛ کاربر واردشده از حساب خودش پر می‌شود
    let { name, phone: contactPhone } = input;
    if ((input.type === 'message' || input.type === 'visit_request') && viewer) {
      const [me] = await this.db.primary
        .select({ name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.id, viewer.id))
        .limit(1);
      name ??= me?.name ?? undefined;
      contactPhone ??= me?.phone;
    }
    if (input.type === 'message' || input.type === 'visit_request') {
      if (!name || !contactPhone) {
        throw new BadRequestException('نام و شماره‌ی تماس خود را وارد کنید');
      }
      if (input.type === 'message' && (input.message?.length ?? 0) < MIN_MESSAGE_LENGTH) {
        throw new BadRequestException('پیام خیلی کوتاه است');
      }
    }

    // تماس صاحب آگهی با آگهی خودش سرنخ حساب نمی‌شود
    if (viewer?.id !== recipientUserId) {
      const [lead] = await this.db.primary
        .insert(leads)
        .values({
          listingId: row.id,
          agentId: row.agentId,
          userId: viewer?.id,
          type: input.type,
          name: name ?? null,
          phone: contactPhone ?? null,
          message: input.message ?? null,
        })
        .returning({ id: leads.id });

      // اعلان برای گیرنده؛ شکستش نباید تماس کاربر را خراب کند
      try {
        await this.db.primary.insert(notifications).values({
          userId: recipientUserId,
          type: 'lead',
          payload: {
            leadId: lead!.id,
            listingPublicId: publicId,
            listingTitle: row.title,
            leadType: input.type,
            name: name ?? null,
          },
        });
      } catch (error) {
        this.logger.warn(`ثبت اعلان سرنخ ناموفق بود: ${String(error)}`);
      }
    }

    switch (input.type) {
      case 'call':
        return { ok: true, type: input.type, phone: `+${digitsOnly(phone)}` };
      case 'whatsapp': {
        const text = `سلام، آگهی «${row.title}» (کد ${row.code}) را در آشیان دیدم.`;
        return {
          ok: true,
          type: input.type,
          whatsappUrl: `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`,
        };
      }
      default:
        return { ok: true, type: input.type };
    }
  }

  async report(
    publicId: string,
    input: ReportListingInput,
    viewer: AuthUser | undefined,
  ): Promise<{ ok: true }> {
    const [listing] = await this.db.primary
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.publicId, publicId), isNull(listings.deletedAt)))
      .limit(1);
    if (!listing) throw new NotFoundException('آگهی پیدا نشد');

    if (viewer) {
      const [existing] = await this.db.primary
        .select({ id: reports.id })
        .from(reports)
        .where(
          and(
            eq(reports.listingId, listing.id),
            eq(reports.reporterId, viewer.id),
            eq(reports.status, 'open'),
          ),
        )
        .limit(1);
      if (existing) throw new ConflictException('گزارش شما قبلاً ثبت شده و در حال بررسی است');
    }

    await this.db.primary.insert(reports).values({
      listingId: listing.id,
      reporterId: viewer?.id,
      reason: input.reason,
      details: input.details ?? null,
    });
    return { ok: true };
  }
}
