import type { DbClient } from '@ashian/db';
import { alias, and, eq, isNull, latOf, lngOf, schema, sql } from '@ashian/db';
import type { Cache } from '@ashian/infra';
import {
  searchQuerySchema,
  type NearbyResponse,
  type NeighborhoodStats,
  type SearchCard,
  type SearchQuery,
} from '@ashian/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE, DB } from '../infra/tokens.js';
import { LocationsService } from '../locations/locations.service.js';
import { SearchApiService } from '../search/search.service.js';
import { findNearby } from './nearby.js';

const { listings, locations } = schema;
const communityLoc = alias(locations, 'community_loc');

const SIMILAR_TTL = 300;
const NEIGHBORHOOD_TTL = 3600;
const SIMILAR_LIMIT = 8;
/** حداقل نمونه برای مقایسه با آگهی‌های هم‌تعداد خواب */
const MIN_BEDROOM_SAMPLE = 3;

interface Core {
  id: string;
  agentId: string | null;
  dealType: SearchCard['dealType'];
  propertyType: SearchCard['propertyType'];
  communityId: string;
  communityPath: string;
  communitySlug: string;
  communityNameFa: string;
  price: number;
  pricePerSqft: number;
  bedrooms: number;
  lng: number;
  lat: number;
}

interface StatsRow extends Record<string, unknown> {
  n_all: number | string;
  avg_all: number | string | null;
  med_all: number | string | null;
  psf_all: number | string | null;
  n_bed: number | string;
  avg_bed: number | string | null;
  med_bed: number | string | null;
}

const num = (v: number | string | null | undefined) => (v === null || v === undefined ? 0 : Number(v));
const percentDelta = (value: number, base: number) =>
  base > 0 ? Math.round(((value - base) / base) * 100) : null;

/**
 * داده‌های تکمیلی صفحه‌ی آگهی که در پاسخ اصلی نیستند: آگهی‌های مشابه، آگهی‌های دیگر مشاور،
 * آمار محله و نزدیک‌ترین نقاط. همه فقط برای آگهی فعال‌اند و کش می‌شوند؛ هیچ‌کدام کاربر را نمی‌شناسند.
 */
@Injectable()
export class ListingExtrasService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(CACHE) private readonly cache: Cache,
    private readonly search: SearchApiService,
    private readonly locationsService: LocationsService,
  ) {}

  private async core(publicId: string): Promise<Core> {
    const [row] = await this.db.replica
      .select({
        id: listings.id,
        agentId: listings.agentId,
        dealType: listings.dealType,
        propertyType: listings.propertyType,
        communityId: listings.communityId,
        communityPath: communityLoc.path,
        communitySlug: communityLoc.slug,
        communityNameFa: communityLoc.nameFa,
        price: listings.price,
        pricePerSqft: listings.pricePerSqft,
        bedrooms: listings.bedrooms,
        lng: lngOf(listings.location),
        lat: latOf(listings.location),
      })
      .from(listings)
      .innerJoin(communityLoc, eq(communityLoc.id, listings.communityId))
      .where(
        and(
          eq(listings.publicId, publicId),
          eq(listings.status, 'active'),
          isNull(listings.deletedAt),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException('آگهی پیدا نشد');
    return row;
  }

  /* ───────────── مشابه ───────────── */

  /**
   * مشابه: همان محله، همان نوع معامله، خواب ±۱ و قیمت در بازه‌ی ۶۰٪ تا ۱۶۰٪. اگر کم بود
   * فیلتر نوع ملک و قیمت شل می‌شود تا بخش خالی نماند.
   */
  async similar(publicId: string): Promise<SearchCard[]> {
    return this.cache.wrap(`similar:${publicId}`, SIMILAR_TTL, async () => {
      const c = await this.core(publicId);
      const run = (extra: Partial<SearchQuery>) =>
        this.search.searchListings(
          searchQuerySchema.parse({
            dealType: [c.dealType],
            location: [c.communityPath],
            pageSize: SIMILAR_LIMIT + 1,
            facets: false,
            ...extra,
          }),
        );
      const strict = await run({
        propertyType: [c.propertyType],
        bedroomsMin: Math.max(0, c.bedrooms - 1),
        bedroomsMax: c.bedrooms + 1,
        priceMin: Math.round(c.price * 0.6),
        priceMax: Math.round(c.price * 1.6),
      });
      let items = strict.items.filter((i) => i.publicId !== publicId);
      if (items.length < 4) {
        const loose = await run({
          bedroomsMin: Math.max(0, c.bedrooms - 1),
          bedroomsMax: c.bedrooms + 1,
        });
        const seen = new Set(items.map((i) => i.publicId));
        items = [
          ...items,
          ...loose.items.filter((i) => i.publicId !== publicId && !seen.has(i.publicId)),
        ];
      }
      return items.slice(0, SIMILAR_LIMIT).map(({ placement: _placement, ...card }) => card);
    });
  }

  /** آگهی‌های دیگر همان مشاور (بدون خود آگهی) */
  async fromAgent(publicId: string): Promise<SearchCard[]> {
    return this.cache.wrap(`agent-listings:${publicId}`, SIMILAR_TTL, async () => {
      const c = await this.core(publicId);
      if (!c.agentId) return [];
      const result = await this.search.searchListings(
        searchQuerySchema.parse({
          agentId: c.agentId,
          pageSize: SIMILAR_LIMIT + 1,
          facets: false,
          sort: 'newest',
        }),
      );
      return result.items
        .filter((i) => i.publicId !== publicId)
        .slice(0, SIMILAR_LIMIT)
        .map(({ placement: _placement, ...card }) => card);
    });
  }

  /* ───────────── محله ───────────── */

  /**
   * آمار بازار یک محله برای یک نوع معامله (و اختیاری تعداد خواب): تجمیعی و یک ساعت کش‌شده.
   * هم صفحه‌ی آگهی و هم راهنمای قیمت در ویزارد ثبت آگهی از همین استفاده می‌کنند.
   */
  async marketStats(communityId: string, dealType: string, bedrooms: number, excludeListingId?: string) {
    const stats = await this.cache.wrap(
      `nbhd:${communityId}:${dealType}:${bedrooms}:${excludeListingId ?? '-'}`,
      NEIGHBORHOOD_TTL,
      async () => {
        const result = await this.db.replica.execute<StatsRow>(sql`
          SELECT
            count(*)::int AS n_all,
            avg(price)::float8 AS avg_all,
            percentile_cont(0.5) WITHIN GROUP (ORDER BY price)::float8 AS med_all,
            avg(price_per_sqft)::float8 AS psf_all,
            (count(*) FILTER (WHERE bedrooms = ${bedrooms}))::int AS n_bed,
            (avg(price) FILTER (WHERE bedrooms = ${bedrooms}))::float8 AS avg_bed,
            (percentile_cont(0.5) WITHIN GROUP (ORDER BY price)
              FILTER (WHERE bedrooms = ${bedrooms}))::float8 AS med_bed
          FROM listings
          WHERE community_id = ${communityId}
            AND deal_type = ${dealType}
            AND status = 'active'
            AND deleted_at IS NULL
            ${excludeListingId ? sql`AND id <> ${excludeListingId}` : sql``}`);
        return result.rows[0] ?? null;
      },
    );
    const nBed = num(stats?.n_bed);
    const avgBed = num(stats?.avg_bed);
    return {
      all: {
        count: num(stats?.n_all),
        avgPrice: Math.round(num(stats?.avg_all)),
        medianPrice: Math.round(num(stats?.med_all)),
        avgPricePerSqft: Math.round(num(stats?.psf_all)),
      },
      sameBedrooms:
        nBed >= MIN_BEDROOM_SAMPLE && avgBed > 0
          ? { count: nBed, avgPrice: Math.round(avgBed), medianPrice: Math.round(num(stats?.med_bed)) }
          : null,
    };
  }

  /** راهنمای قیمت ویزارد: مکان (برج یا محله) → آمار محله‌ی والد؛ null اگر مکان نامعتبر باشد */
  async marketFor(locationId: string, dealType: string, bedrooms: number) {
    const place = await this.locationsService.resolveCommunity(locationId);
    if (!place) return null;
    const [community] = await this.db.replica
      .select({ nameFa: communityLoc.nameFa })
      .from(communityLoc)
      .where(eq(communityLoc.id, place.communityId))
      .limit(1);
    return this.marketGuide(place.communityId, community?.nameFa ?? '', dealType, bedrooms);
  }

  /** راهنمای قیمت ویزارد: بازار محله‌ی انتخاب‌شده (بدون وابستگی به آگهی) */
  async marketGuide(communityId: string, communityNameFa: string, dealType: string, bedrooms: number) {
    return { community: { nameFa: communityNameFa }, dealType, ...(await this.marketStats(communityId, dealType, bedrooms)) };
  }

  async neighborhood(publicId: string): Promise<NeighborhoodStats> {
    const c = await this.core(publicId);
    const { all, sameBedrooms } = await this.marketStats(c.communityId, c.dealType, c.bedrooms, c.id);
    return {
      community: { slug: c.communitySlug, nameFa: c.communityNameFa },
      dealType: c.dealType,
      all,
      sameBedrooms,
      priceDeltaPercent: sameBedrooms ? percentDelta(c.price, sameBedrooms.avgPrice) : null,
      psfDeltaPercent:
        all.count >= MIN_BEDROOM_SAMPLE ? percentDelta(c.pricePerSqft, all.avgPricePerSqft) : null,
    };
  }
  /* ───────────── نزدیک‌ترین‌ها ───────────── */

  async nearby(publicId: string): Promise<NearbyResponse> {
    const c = await this.core(publicId);
    return { items: findNearby(c.lng, c.lat) };
  }
}
