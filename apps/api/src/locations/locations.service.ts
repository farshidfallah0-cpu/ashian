import type { DbClient } from '@ashian/db';
import { and, asc, eq, isNull, latOf, lngOf, schema, sql } from '@ashian/db';
import type { Cache } from '@ashian/infra';
import type { LocationType } from '@ashian/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE, DB } from '../infra/tokens.js';

const { locations, listings } = schema;

export interface LocationDto {
  id: string;
  parentId: string | null;
  type: LocationType;
  slug: string;
  path: string;
  nameFa: string;
  nameEn: string;
  aliases: string[];
  lng: number | null;
  lat: number | null;
  /** تعداد آگهی‌های فعال (فقط برای محله و برج) */
  listingCount: number;
}

const TTL = 300;

@Injectable()
export class LocationsService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(CACHE) private readonly cache: Cache,
  ) {}

  /** تعداد آگهی‌های فعال هر مکان؛ یک کوئری تجمیعی برای همه (کش ۵ دقیقه) */
  private counts(): Promise<Map<string, number>> {
    return this.cache
      .wrap<Array<[string, number]>>('loc:counts', TTL, async () => {
        const result = await this.db.replica.execute<{ id: string; n: number }>(sql`
          SELECT id, sum(n)::int AS n FROM (
            SELECT community_id AS id, count(*) AS n FROM listings
              WHERE status = 'active' AND deleted_at IS NULL GROUP BY 1
            UNION ALL
            SELECT location_id AS id, count(*) AS n FROM listings
              WHERE status = 'active' AND deleted_at IS NULL AND location_id <> community_id GROUP BY 1
          ) t GROUP BY id`);
        return result.rows.map((r) => [r.id, Number(r.n)] as [string, number]);
      })
      .then((entries) => new Map(entries));
  }

  private async all(): Promise<LocationDto[]> {
    return this.cache.wrap('loc:all', TTL, async () => {
      const [rows, counts] = await Promise.all([
        this.db.replica
          .select({
            id: locations.id,
            parentId: locations.parentId,
            type: locations.type,
            slug: locations.slug,
            path: locations.path,
            nameFa: locations.nameFa,
            nameEn: locations.nameEn,
            aliases: locations.aliases,
            lng: lngOf(locations.center),
            lat: latOf(locations.center),
          })
          .from(locations)
          .orderBy(asc(locations.type), asc(locations.nameEn)),
        this.counts(),
      ]);
      return rows.map((r) => ({ ...r, listingCount: counts.get(r.id) ?? 0 }));
    });
  }

  async list(filter: { type?: LocationType; parentId?: string }): Promise<LocationDto[]> {
    return (await this.all()).filter(
      (l) =>
        (!filter.type || l.type === filter.type) &&
        (!filter.parentId || l.parentId === filter.parentId),
    );
  }

  /** درخت کامل: امارت ← محله‌ها ← برج‌ها (برای فهرست‌ها و فرم ثبت آگهی) */
  async tree() {
    const all = await this.all();
    const children = new Map<string | null, LocationDto[]>();
    for (const l of all) children.set(l.parentId, [...(children.get(l.parentId) ?? []), l]);
    const build = (parent: string | null): Array<LocationDto & { children: unknown[] }> =>
      (children.get(parent) ?? []).map((l) => ({ ...l, children: build(l.id) }));
    return build(null);
  }

  /** پیدا کردن با slug: محله، یا برج داخل یک محله */
  async bySlug(communitySlug: string, towerSlug?: string): Promise<LocationDto> {
    const all = await this.all();
    const community = all.find((l) => l.type === 'community' && l.slug === communitySlug);
    const found = towerSlug
      ? all.find((l) => l.type === 'tower' && l.parentId === community?.id && l.slug === towerSlug)
      : community;
    if (!found) throw new NotFoundException('مکان پیدا نشد');
    return found;
  }

  /** محله‌ی والد برای هر مکان (برج → محله). برای آگهی لازم است. */
  async resolveCommunity(
    locationId: string,
  ): Promise<{ locationId: string; communityId: string; lng: number; lat: number } | null> {
    const [row] = await this.db.primary
      .select({
        id: locations.id,
        parentId: locations.parentId,
        type: locations.type,
        lng: lngOf(locations.center),
        lat: latOf(locations.center),
      })
      .from(locations)
      .where(eq(locations.id, locationId))
      .limit(1);
    if (!row || row.type === 'emirate') return null;
    return {
      locationId: row.id,
      communityId: row.type === 'tower' ? row.parentId! : row.id,
      lng: row.lng,
      lat: row.lat,
    };
  }

  /** میانگین قیمت هر فوت مربع فروش در یک محله؛ برای هشدار داده‌ی غیرعادی */
  async avgSalePricePerSqft(communityId: string): Promise<number | undefined> {
    return this.cache
      .wrap(`loc:psf:${communityId}`, 3600, async () => {
        const [row] = await this.db.replica
          .select({ avg: sql<number | null>`avg(${listings.pricePerSqft})::int` })
          .from(listings)
          .where(
            and(
              eq(listings.communityId, communityId),
              eq(listings.dealType, 'sale'),
              eq(listings.status, 'active'),
              isNull(listings.deletedAt),
            ),
          );
        return row?.avg ?? 0;
      })
      .then((v) => (v > 0 ? v : undefined));
  }
}
