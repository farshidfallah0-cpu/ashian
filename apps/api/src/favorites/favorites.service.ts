import type { DbClient } from '@ashian/db';
import { and, count, desc, eq, isNull, schema } from '@ashian/db';
import { Inject, Injectable } from '@nestjs/common';
import { toPage, type Page } from '../common/pipes.js';
import { DB } from '../infra/tokens.js';
import { cardQuery, toCard, type ListingCard } from '../listings/listing-card.js';
import { ListingsService } from '../listings/listings.service.js';

const { favorites, listings } = schema;

/** سقف علاقه‌مندی‌ها برای هر کاربر؛ جلوگیری از سوءاستفاده */
const MAX_FAVORITES = 500;

@Injectable()
export class FavoritesService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly listingsService: ListingsService,
  ) {}

  async list(userId: string, page: number, pageSize: number): Promise<Page<ListingCard>> {
    const where = and(
      eq(favorites.userId, userId),
      isNull(listings.deletedAt),
      eq(listings.status, 'active'),
    );
    const [rows, [total]] = await Promise.all([
      cardQuery(this.db.primary)
        .innerJoin(favorites, eq(favorites.listingId, listings.id))
        .where(where)
        .orderBy(desc(favorites.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.primary
        .select({ n: count() })
        .from(favorites)
        .innerJoin(listings, eq(listings.id, favorites.listingId))
        .where(where),
    ]);
    // ترتیب نتایج همان ترتیب افزودن به علاقه‌مندی‌هاست (تازه‌ترین اول)
    return toPage(rows.map(toCard), total?.n ?? 0, page, pageSize);
  }

  /** فقط شناسه‌ها؛ برای رنگی کردن قلب‌ها در لیست‌ها با یک درخواست سبک */
  async ids(userId: string): Promise<string[]> {
    const rows = await this.db.primary
      .select({ publicId: listings.publicId })
      .from(favorites)
      .innerJoin(listings, eq(listings.id, favorites.listingId))
      .where(and(eq(favorites.userId, userId), isNull(listings.deletedAt)))
      .orderBy(desc(favorites.createdAt))
      .limit(MAX_FAVORITES);
    return rows.map((r) => r.publicId);
  }

  /** ایدم‌پوتنت: چندبار PUT همان نتیجه را می‌دهد */
  async add(userId: string, publicId: string): Promise<void> {
    const listingId = await this.listingsService.idByPublicId(publicId);
    await this.db.primary.insert(favorites).values({ userId, listingId }).onConflictDoNothing();
  }

  async remove(userId: string, publicId: string): Promise<void> {
    const [row] = await this.db.primary
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.publicId, publicId))
      .limit(1);
    if (!row) return;
    await this.db.primary
      .delete(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.listingId, row.id)));
  }
}
