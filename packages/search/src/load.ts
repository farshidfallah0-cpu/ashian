import type { Database, DbClient } from '@ashian/db';
import {
  alias,
  and,
  asc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  latOf,
  lngOf,
  schema,
  sql,
} from '@ashian/db';
import { buildListingDoc, buildSuggestDoc, NEVER_EXPIRES, type ListingSource } from './document.js';
import type { MediaVariants, SearchCard } from '@ashian/shared';
import type { ListingDoc, SuggestDoc } from './types.js';

const { listings, listingMedia, listingAmenities, amenities, locations, agents, users, agencies } =
  schema;

const placeLoc = alias(locations, 'place_loc');
const communityLoc = alias(locations, 'community_loc');
const cover = alias(listingMedia, 'cover');
const agentUser = alias(users, 'agent_user');

export interface LoadedBatch {
  docs: ListingDoc[];
  /** شناسه‌ی عمومی آگهی‌هایی که دیگر نباید در ایندکس باشند */
  removedIds: string[];
}

const GALLERY_PHOTOS = 4;

function slimVariants(v: MediaVariants): MediaVariants {
  const pick = (files: MediaVariants['avif']) =>
    files ? { 640: files[640], 960: files[960] } : undefined;
  return { avif: pick(v.avif), webp: pick(v.webp) };
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * خواندن آگهی‌ها از PostgreSQL و تبدیل به سند ایندکس.
 * تنها جایی که جستجو با دیتابیس اصلی تماس می‌گیرد: همگام‌سازی و reindex، نه درخواست کاربر.
 */
export function createDocLoader(db: DbClient) {
  const baseQuery = (database: Database) =>
    database
      .select({
        listing: listings,
        lng: lngOf(listings.location),
        lat: latOf(listings.location),
        place: {
          type: placeLoc.type,
          path: placeLoc.path,
          slug: placeLoc.slug,
          nameFa: placeLoc.nameFa,
          nameEn: placeLoc.nameEn,
          aliases: placeLoc.aliases,
        },
        community: {
          slug: communityLoc.slug,
          nameFa: communityLoc.nameFa,
          nameEn: communityLoc.nameEn,
          aliases: communityLoc.aliases,
        },
        cover: {
          id: cover.id,
          variants: cover.variants,
          blurhash: cover.blurhash,
          width: cover.width,
          height: cover.height,
        },
        agent: {
          id: agents.id,
          name: agentUser.name,
          avatarKey: agentUser.avatarKey,
          verification: agents.verificationStatus,
          isTop: agents.isTopAgent,
          agencyName: agencies.name,
        },
      })
      .from(listings)
      .innerJoin(placeLoc, eq(placeLoc.id, listings.locationId))
      .innerJoin(communityLoc, eq(communityLoc.id, listings.communityId))
      .leftJoin(
        cover,
        and(
          eq(cover.listingId, listings.id),
          eq(cover.position, 0),
          eq(cover.status, 'ready'),
          eq(cover.kind, 'image'),
        ),
      )
      .leftJoin(agents, eq(agents.id, listings.agentId))
      .leftJoin(agentUser, eq(agentUser.id, agents.userId))
      .leftJoin(agencies, eq(agencies.id, agents.agencyId));

  type Row = Awaited<ReturnType<ReturnType<typeof baseQuery>['limit']>>[number];

  async function emirates(database: Database) {
    const rows = await database
      .select({ path: locations.path, nameFa: locations.nameFa, nameEn: locations.nameEn })
      .from(locations)
      .where(eq(locations.type, 'emirate'));
    return new Map(rows.map((r) => [r.path.split('/')[0]!, r]));
  }

  /** عکس‌های گالری (۴ تای اول، فقط عرض ۶۴۰ و ۹۶۰ تا سند سبک بماند) و نشان‌های رسانه */
  async function mediaInfo(database: Database, listingIds: string[]) {
    const result = new Map<string, { photos: SearchCard['photos']; media: SearchCard['media'] }>();
    if (listingIds.length === 0) return result;
    const rows = await database
      .select({
        listingId: listingMedia.listingId,
        kind: listingMedia.kind,
        variants: listingMedia.variants,
        blurhash: listingMedia.blurhash,
        width: listingMedia.width,
        height: listingMedia.height,
      })
      .from(listingMedia)
      .where(and(inArray(listingMedia.listingId, listingIds), eq(listingMedia.status, 'ready')))
      .orderBy(asc(listingMedia.position));
    for (const r of rows) {
      const entry = result.get(r.listingId) ?? {
        photos: [],
        media: { video: false, tour360: false, floorplan: false },
      };
      if (r.kind === 'image' && r.variants && entry.photos.length < GALLERY_PHOTOS) {
        entry.photos.push({
          variants: slimVariants(r.variants),
          blurhash: r.blurhash,
          width: r.width,
          height: r.height,
        });
      } else if (r.kind === 'video') entry.media.video = true;
      else if (r.kind === 'tour360') entry.media.tour360 = true;
      else if (r.kind === 'floorplan') entry.media.floorplan = true;
      result.set(r.listingId, entry);
    }
    return result;
  }

  async function amenitySlugs(database: Database, listingIds: string[]) {
    const map = new Map<string, string[]>();
    if (listingIds.length === 0) return map;
    const rows = await database
      .select({ listingId: listingAmenities.listingId, slug: amenities.slug })
      .from(listingAmenities)
      .innerJoin(amenities, eq(amenities.id, listingAmenities.amenityId))
      .where(inArray(listingAmenities.listingId, listingIds));
    for (const r of rows) map.set(r.listingId, [...(map.get(r.listingId) ?? []), r.slug]);
    return map;
  }

  const isIndexable = (row: Row, now: number): boolean => {
    const l = row.listing;
    return (
      l.status === 'active' &&
      l.deletedAt === null &&
      (l.expiresAt === null || l.expiresAt.getTime() / 1000 > now)
    );
  };

  async function toBatch(database: Database, rows: Row[]): Promise<LoadedBatch> {
    const now = nowSeconds();
    const indexable = rows.filter((r) => isIndexable(r, now));
    const ids = indexable.map((r) => r.listing.id);
    const [slugs, emirateMap, mediaMap] = await Promise.all([
      amenitySlugs(database, ids),
      emirates(database),
      mediaInfo(database, ids),
    ]);

    const docs = indexable.map((r) => {
      const l = r.listing;
      const source: ListingSource = {
        publicId: l.publicId,
        code: l.code,
        dealType: l.dealType,
        propertyType: l.propertyType,
        furnishing: l.furnishing,
        // ارتقای «ویژه» پس از featuredUntil تمام می‌شود (خالی = بدون انقضا)
        tier: l.tier === 'featured' && (!l.featuredUntil || l.featuredUntil.getTime() > Date.now())
          ? 'featured'
          : 'standard',
        isVerified: l.isVerified,
        title: l.title,
        price: l.price,
        pricePerSqft: l.pricePerSqft,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        areaSqft: l.areaSqft,
        parkingSpaces: l.parkingSpaces,
        photoCount: l.photoCount,
        rentCheques: l.rentCheques,
        qualityScore: l.qualityScore,
        publishedAt: l.publishedAt,
        createdAt: l.createdAt,
        expiresAt: l.expiresAt,
        lng: r.lng,
        lat: r.lat,
        amenitySlugs: slugs.get(l.id) ?? [],
        photos: mediaMap.get(l.id)?.photos ?? [],
        media: mediaMap.get(l.id)?.media ?? { video: false, tour360: false, floorplan: false },
        place: r.place,
        community: r.community,
        emirate: emirateMap.get(r.place.path.split('/')[0]!) ?? null,
        cover: r.cover?.id
          ? {
              variants: r.cover.variants,
              blurhash: r.cover.blurhash,
              width: r.cover.width,
              height: r.cover.height,
            }
          : null,
        agent: r.agent?.id
          ? {
              id: r.agent.id,
              name: r.agent.name ?? 'مشاور',
              avatarKey: r.agent.avatarKey,
              isVerified: r.agent.verification === 'verified',
              isTopAgent: r.agent.isTop ?? false,
              agencyName: r.agent.agencyName,
            }
          : null,
      };
      return buildListingDoc(source, now);
    });

    return {
      docs,
      removedIds: rows.filter((r) => !isIndexable(r, now)).map((r) => r.listing.publicId),
    };
  }

  return {
    /** وضعیت فعلی چند آگهی؛ آگهی‌های غیرقابل‌ایندکس در removedIds می‌آیند */
    async byIds(listingIds: string[]): Promise<LoadedBatch> {
      if (listingIds.length === 0) return { docs: [], removedIds: [] };
      const rows = await baseQuery(db.primary).where(inArray(listings.id, listingIds));
      return toBatch(db.primary, rows);
    },

    /**
     * همه‌ی آگهی‌های قابل‌ایندکس، دسته‌دسته (صفحه‌بندی با کلید id تا حافظه ثابت بماند).
     * `changedSince`: فقط آگهی‌هایی که از آن زمان تغییر کرده‌اند (برای جبران تغییرات حین reindex)؛
     * در این حالت آگهی‌های خارج‌شده هم گزارش می‌شوند.
     */
    async *batches(
      options: { size?: number; changedSince?: Date } = {},
    ): AsyncGenerator<LoadedBatch> {
      const size = options.size ?? 500;
      const database = options.changedSince ? db.primary : db.replica;
      const now = new Date();
      let after: string | null = null;
      for (;;) {
        const where = and(
          after ? gt(listings.id, after) : undefined,
          options.changedSince
            ? gte(listings.updatedAt, options.changedSince)
            : and(
                eq(listings.status, 'active'),
                isNull(listings.deletedAt),
                sql`(${listings.expiresAt} IS NULL OR ${listings.expiresAt} > ${now})`,
              ),
        );
        const rows = await baseQuery(database).where(where).orderBy(asc(listings.id)).limit(size);
        if (rows.length === 0) return;
        after = rows[rows.length - 1]!.listing.id;
        yield await toBatch(database, rows);
        if (rows.length < size) return;
      }
    },

    /** پیشنهادهای خودکار: محله‌ها، برج‌ها، مشاوران و آژانس‌های دارای آگهی فعال */
    async suggestions(): Promise<SuggestDoc[]> {
      const database = db.replica;
      const [locationRows, counts, agentRows] = await Promise.all([
        database
          .select({
            id: locations.id,
            parentId: locations.parentId,
            type: locations.type,
            path: locations.path,
            nameFa: locations.nameFa,
            nameEn: locations.nameEn,
            aliases: locations.aliases,
          })
          .from(locations),
        database.execute<{ id: string; n: number }>(sql`
          SELECT id, sum(n)::int AS n FROM (
            SELECT community_id AS id, count(*) AS n FROM listings
              WHERE status = 'active' AND deleted_at IS NULL GROUP BY 1
            UNION ALL
            SELECT location_id AS id, count(*) AS n FROM listings
              WHERE status = 'active' AND deleted_at IS NULL AND location_id <> community_id GROUP BY 1
          ) t GROUP BY id`),
        database
          .select({
            id: agents.id,
            name: users.name,
            agencyId: agencies.id,
            agencyName: agencies.name,
            agencyNameEn: agencies.nameEn,
            agencySlug: agencies.slug,
            listingCount: agents.activeListingCount,
          })
          .from(agents)
          .innerJoin(users, eq(users.id, agents.userId))
          .leftJoin(agencies, eq(agencies.id, agents.agencyId))
          .where(and(isNull(agents.deletedAt), gt(agents.activeListingCount, 0))),
      ]);

      const countOf = new Map(counts.rows.map((r) => [r.id, Number(r.n)]));
      const byId = new Map(locationRows.map((l) => [l.id, l]));
      const docs: SuggestDoc[] = [];

      for (const l of locationRows) {
        if (l.type === 'emirate') continue;
        const listingCount = countOf.get(l.id) ?? 0;
        if (listingCount === 0) continue;
        const parent = l.parentId ? byId.get(l.parentId) : undefined;
        docs.push(
          buildSuggestDoc({
            kind: l.type,
            ref: l.path,
            label: l.nameFa,
            sublabel: l.type === 'tower' ? (parent?.nameFa ?? null) : l.nameEn,
            names: [l.nameFa, l.nameEn, ...l.aliases, l.type === 'tower' ? parent?.nameFa : null],
            listingCount,
          }),
        );
      }

      const agencyTotals = new Map<
        string,
        { slug: string; name: string; nameEn: string | null; n: number }
      >();
      for (const a of agentRows) {
        docs.push(
          buildSuggestDoc({
            kind: 'agent',
            ref: a.id,
            label: a.name ?? 'مشاور',
            sublabel: a.agencyName,
            names: [a.name, a.agencyName],
            listingCount: a.listingCount,
          }),
        );
        if (a.agencyId && a.agencySlug && a.agencyName) {
          const entry = agencyTotals.get(a.agencyId) ?? {
            slug: a.agencySlug,
            name: a.agencyName,
            nameEn: a.agencyNameEn,
            n: 0,
          };
          entry.n += a.listingCount;
          agencyTotals.set(a.agencyId, entry);
        }
      }
      for (const agency of agencyTotals.values()) {
        docs.push(
          buildSuggestDoc({
            kind: 'agency',
            ref: agency.slug,
            label: agency.name,
            sublabel: agency.nameEn,
            names: [agency.name, agency.nameEn],
            listingCount: agency.n,
          }),
        );
      }
      return docs;
    },
  };
}

export type DocLoader = ReturnType<typeof createDocLoader>;
export { NEVER_EXPIRES };
