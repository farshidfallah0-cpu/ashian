import type { DbClient } from '@ashian/db';
import { and, count, desc, eq, schema } from '@ashian/db';
import {
  MAX_SAVED_SEARCHES,
  searchQuerySchema,
  serializeSearchQuery,
  type CreateSavedSearchInput,
  type SavedSearchDto,
  type UpdateSavedSearchInput,
} from '@ashian/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DB } from '../infra/tokens.js';

const { savedSearches } = schema;

@Injectable()
export class SavedSearchesService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async list(userId: string): Promise<SavedSearchDto[]> {
    const rows = await this.db.primary
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(desc(savedSearches.createdAt));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      /** query string استاندارد؛ برای ساخت لینک /search?… */
      query: String((r.query as { qs?: string }).qs ?? ''),
      frequency: r.frequency,
      channels: r.channels as SavedSearchDto['channels'],
      lastNotifiedAt: r.lastNotifiedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async create(userId: string, input: CreateSavedSearchInput) {
    // query باید از اسکیمای جستجو عبور کند؛ شکل استاندارد ذخیره می‌شود (بدون page)
    const params = Object.fromEntries(new URLSearchParams(input.query));
    const parsed = searchQuerySchema.safeParse(params);
    if (!parsed.success) throw new BadRequestException('فیلترهای جستجو نامعتبر است');
    // شکل استاندارد: بدون صفحه، اندازه‌ی صفحه، facets و مرتب‌سازی پیش‌فرض (لینک کوتاه و یکتا)
    const canonical = new URLSearchParams(serializeSearchQuery(parsed.data));
    for (const key of ['page', 'pageSize', 'facets']) canonical.delete(key);
    if (canonical.get('sort') === 'relevance') canonical.delete('sort');
    const qs = canonical.toString();

    const [{ n } = { n: 0 }] = await this.db.primary
      .select({ n: count() })
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId));
    if (n >= MAX_SAVED_SEARCHES)
      throw new ConflictException('تعداد جستجوهای ذخیره‌شده به حد مجاز رسیده است');

    const [row] = await this.db.primary
      .insert(savedSearches)
      .values({
        userId,
        name: input.name,
        query: { qs },
        frequency: input.frequency,
        channels: input.channels,
        // هشدار فقط برای آگهی‌هایی است که بعد از ذخیره‌ی جستجو منتشر شوند
        lastNotifiedAt: new Date(),
      })
      .returning({ id: savedSearches.id });
    return { id: row!.id };
  }

  async update(userId: string, id: string, input: UpdateSavedSearchInput) {
    const [row] = await this.db.primary
      .update(savedSearches)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
        ...(input.channels !== undefined ? { channels: input.channels } : {}),
      })
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
      .returning({ id: savedSearches.id });
    if (!row) throw new NotFoundException('جستجوی ذخیره‌شده پیدا نشد');
  }

  async remove(userId: string, id: string) {
    const deleted = await this.db.primary
      .delete(savedSearches)
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
      .returning({ id: savedSearches.id });
    if (deleted.length === 0) throw new NotFoundException('جستجوی ذخیره‌شده پیدا نشد');
  }
}
