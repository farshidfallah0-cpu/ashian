import type { DbClient } from '@ashian/db';
import { and, eq, schema } from '@ashian/db';
import { MARKET } from '@ashian/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { DB } from '../infra/tokens.js';
import { ListingsService } from '../listings/listings.service.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment.provider.js';

const { orders, listings } = schema;

const DAY_MS = 24 * 3600 * 1000;

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly listingsService: ListingsService,
  ) {}

  /** بسته‌های ارتقای «ویژه»؛ قیمت‌ها فقط سمت سرور تعیین می‌شود */
  packages() {
    return MARKET.promotion.featuredOptions.map((o) => ({ ...o, currency: MARKET.currency.code }));
  }

  /** ساخت سفارش ارتقا و آدرس پرداخت. فقط آگهی فعال یا در انتظار تأیید قابل ارتقاست. */
  async promote(user: AuthUser, publicId: string, days: number) {
    const option = MARKET.promotion.featuredOptions.find((o) => o.days === days);
    if (!option) throw new BadRequestException('بسته‌ی ارتقا نامعتبر است');
    const listing = await this.listingsService.ownedListing(user, publicId);
    if (listing.status !== 'active' && listing.status !== 'pending_review') {
      throw new ConflictException('فقط آگهی فعال یا در انتظار تأیید را می‌توان ارتقا داد');
    }

    const [order] = await this.db.primary
      .insert(orders)
      .values({
        userId: user.id,
        listingId: listing.id,
        kind: 'featured',
        days: option.days,
        amount: option.price,
        currency: MARKET.currency.code,
        provider: this.provider.kind,
      })
      .returning();
    const session = await this.provider.createCheckout({
      orderId: order!.id,
      amount: option.price,
      currency: MARKET.currency.code,
      description: `ارتقای «ویژه» ${option.days} روزه، آگهی ${listing.code}`,
    });
    await this.db.primary
      .update(orders)
      .set({ providerRef: session.providerRef })
      .where(eq(orders.id, order!.id));
    return { orderId: order!.id, redirectUrl: session.redirectUrl };
  }

  async getOrder(user: AuthUser, orderId: string) {
    const [row] = await this.db.primary
      .select({ order: orders, publicId: listings.publicId, title: listings.title })
      .from(orders)
      .innerJoin(listings, eq(listings.id, orders.listingId))
      .where(eq(orders.id, orderId))
      .limit(1);
    if (!row) throw new NotFoundException('سفارش پیدا نشد');
    if (row.order.userId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('این سفارش متعلق به شما نیست');
    }
    const { order } = row;
    return {
      id: order.id,
      status: order.status,
      kind: order.kind,
      days: order.days,
      amount: order.amount,
      currency: order.currency,
      provider: order.provider,
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt?.toISOString() ?? null,
      listing: { publicId: row.publicId, title: row.title },
    };
  }

  /**
   * پرداخت موفق (ایدم‌پوتنت). webhook درگاه واقعی هم همین را صدا می‌زند: سفارش paid می‌شود و
   * آگهی تا `days` روز ویژه می‌شود (اگر هنوز ویژه است، از پایان فعلی تمدید می‌شود).
   */
  async markPaid(orderId: string): Promise<void> {
    await this.db.primary.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!order) throw new NotFoundException('سفارش پیدا نشد');
      if (order.status === 'paid') return;
      if (order.status !== 'pending') throw new ConflictException('این سفارش دیگر قابل پرداخت نیست');

      await tx
        .update(orders)
        .set({ status: 'paid', paidAt: new Date() })
        .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')));

      const [listing] = await tx.select().from(listings).where(eq(listings.id, order.listingId));
      const base =
        listing?.tier === 'featured' && listing.featuredUntil && listing.featuredUntil > new Date()
          ? listing.featuredUntil.getTime()
          : Date.now();
      await tx
        .update(listings)
        .set({ tier: 'featured', featuredUntil: new Date(base + order.days * DAY_MS) })
        .where(eq(listings.id, order.listingId));
    });
    const [order] = await this.db.primary.select().from(orders).where(eq(orders.id, orderId));
    if (order) await this.listingsService.requestSearchSync(order.listingId);
  }

  async markFailed(orderId: string): Promise<void> {
    await this.db.primary
      .update(orders)
      .set({ status: 'failed' })
      .where(and(eq(orders.id, orderId), eq(orders.status, 'pending')));
  }
}