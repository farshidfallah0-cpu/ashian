import type { DbClient } from '@ashian/db';
import { sql } from '@ashian/db';
import type { Cache } from '@ashian/infra';
import { SearchService, type SearchEngine } from '@ashian/search';
import type { HomeCommunity, HomeResponse, MediaVariants } from '@ashian/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE, DB, SEARCH_ENGINE } from '../infra/tokens.js';

const TTL_SECONDS = 300;
const COMMUNITY_LIMIT = 7;
const LATEST_LIMIT = 12;
const PICKS_LIMIT = 8;

interface CommunityRow extends Record<string, unknown> {
  slug: string;
  path: string;
  name_fa: string;
  name_en: string;
  n: number;
  sale_psf: number | null;
  avg_rent: number | null;
  variants: MediaVariants | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
}

/**
 * داده‌ی ویترین صفحه‌ی اصلی. نتیجه ۵ دقیقه کش می‌شود و صفحه‌ی اصلی هم ISR است،
 * پس این کوئری‌ها هیچ‌وقت زیر بار کاربر اجرا نمی‌شوند.
 * شمارش‌ها و آگهی‌ها از موتور جستجو می‌آیند؛ فقط میانگین قیمت محله‌ها (تجمیع، نه جستجو) از دیتابیس است.
 */
@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name);
  private readonly search: SearchService;

  constructor(
    @Inject(DB) private readonly db: DbClient,
    @Inject(CACHE) private readonly cache: Cache,
    @Inject(SEARCH_ENGINE) private readonly engine: SearchEngine,
  ) {
    this.search = new SearchService({ engine, cache });
  }

  get(): Promise<HomeResponse> {
    return this.cache.wrap('home:v1', TTL_SECONDS, () => this.build());
  }

  private async build(): Promise<HomeResponse> {
    const [
      rentFacets,
      saleFacets,
      latestVerified,
      rentPicks,
      salePicks,
      communities,
      counts,
      engineStats,
    ] = await Promise.all([
      this.search.facetsFor({ dealType: ['rent'] }),
      this.search.facetsFor({ dealType: ['sale'] }),
      this.search.latest({ verified: true, limit: LATEST_LIMIT }),
      this.search.latest({ dealType: ['rent'], sort: 'relevance', limit: PICKS_LIMIT }),
      this.search.latest({ dealType: ['sale'], sort: 'relevance', limit: PICKS_LIMIT }),
      this.communities(),
      this.counts(),
      this.engine.stats(),
    ]);

    return {
      stats: {
        listings: engineStats.listings,
        communities: counts.communities,
        agents: counts.agents,
      },
      propertyTypes: {
        rent: rentFacets?.propertyType ?? [],
        sale: saleFacets?.propertyType ?? [],
      },
      communities,
      latestVerified,
      rentPicks,
      salePicks,
      generatedAt: new Date().toISOString(),
    };
  }

  private async counts() {
    const result = await this.db.replica.execute<{ communities: number; agents: number }>(sql`
      SELECT
        (SELECT count(DISTINCT community_id) FROM listings
          WHERE status = 'active' AND deleted_at IS NULL)::int AS communities,
        (SELECT count(*) FROM agents WHERE deleted_at IS NULL AND active_listing_count > 0)::int AS agents`);
    const row = result.rows[0];
    return { communities: Number(row?.communities ?? 0), agents: Number(row?.agents ?? 0) };
  }

  /** پرآگهی‌ترین محله‌ها با میانگین قیمت و بهترین عکس (ترجیحاً آگهی تأییدشده با کیفیت بالا) */
  private async communities(): Promise<HomeCommunity[]> {
    const result = await this.db.replica.execute<CommunityRow>(sql`
      WITH active AS (
        SELECT id, community_id, deal_type, price, price_per_sqft, quality_score, is_verified
        FROM listings
        WHERE status = 'active' AND deleted_at IS NULL
          AND (expires_at IS NULL OR expires_at > now())
      ), agg AS (
        SELECT community_id,
               count(*)::int AS n,
               avg(price_per_sqft) FILTER (WHERE deal_type = 'sale')::int AS sale_psf,
               avg(price) FILTER (WHERE deal_type = 'rent')::int AS avg_rent
        FROM active GROUP BY community_id
        ORDER BY n DESC LIMIT ${COMMUNITY_LIMIT}
      )
      SELECT l.slug, l.path, l.name_fa, l.name_en, t.n, t.sale_psf, t.avg_rent,
             c.variants, c.blurhash, c.width, c.height
      FROM agg t
      JOIN locations l ON l.id = t.community_id
      LEFT JOIN LATERAL (
        SELECT m.variants, m.blurhash, m.width, m.height
        FROM active a
        JOIN listing_media m ON m.listing_id = a.id
          AND m.position = 0 AND m.status = 'ready' AND m.kind = 'image'
        WHERE a.community_id = t.community_id
        ORDER BY a.is_verified DESC, a.quality_score DESC, a.id
        LIMIT 1
      ) c ON true
      ORDER BY t.n DESC`);

    return result.rows.map((r) => ({
      slug: r.slug,
      path: r.path,
      nameFa: r.name_fa,
      nameEn: r.name_en,
      listingCount: Number(r.n),
      avgSalePricePerSqft: r.sale_psf === null ? null : Number(r.sale_psf),
      avgYearlyRent: r.avg_rent === null ? null : Number(r.avg_rent),
      cover: r.variants
        ? { variants: r.variants, blurhash: r.blurhash, width: r.width, height: r.height }
        : null,
    }));
  }
}
