import type { DbClient } from '@ashian/db';
import { and, eq, isNotNull, isNull, ne, schema, sql } from '@ashian/db';
import {
  SAME_PHOTO_DISTANCE,
  detectQualityWarnings,
  hammingHex,
  type DealType,
  type QualityWarning,
} from '@ashian/shared';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from '../infra/tokens.js';
import { LocationsService } from '../locations/locations.service.js';

const { listings, listingMedia } = schema;

/** آگهی‌های مشابه تا این فاصله (درجه‌ی جغرافیایی ≈ ۲۵۰ متر در عرض دبی) هم‌مکان حساب می‌شوند */
const SAME_PLACE_DEGREES = 0.0025;
const AREA_TOLERANCE = 0.07;
const PRICE_TOLERANCE = 0.03;
/** سقف عکس‌هایی که برای مقایسه‌ی هش از یک محله خوانده می‌شود */
const PHOTO_SCAN_LIMIT = 4_000;

export interface DuplicateMatch {
  publicId: string;
  title: string;
  reason: 'photos' | 'details';
  /** فقط برای reason=photos: کمترین فاصله‌ی همینگ (۰ = عین هم) */
  photoDistance?: number;
}

export interface ListingReview {
  warnings: QualityWarning[];
  duplicates: DuplicateMatch[];
  photos: { ready: number; processing: number; failed: number };
}

/**
 * بررسی‌های پیش از ارسال: داده‌ی غیرعادی (نسبت به میانگین محله) و آگهی تکراری.
 * تکراری بودن از دو راه سنجیده می‌شود: عکس (هش ادراکی با آگهی‌های فعال همان محله)
 * و مشخصات (همان محله، معامله، خواب، متراژ ±۷٪ و قیمت ±۳٪ در شعاع ≈ ۲۵۰ متر).
 */
@Injectable()
export class ListingChecksService {
  constructor(
    @Inject(DB) private readonly db: DbClient,
    private readonly locationsService: LocationsService,
  ) {}

  async review(listingId: string): Promise<ListingReview> {
    const [listing] = await this.db.primary
      .select()
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);
    if (!listing) return { warnings: [], duplicates: [], photos: { ready: 0, processing: 0, failed: 0 } };

    const avg = await this.locationsService.avgSalePricePerSqft(listing.communityId);
    const warnings = detectQualityWarnings(
      {
        dealType: listing.dealType as DealType,
        price: listing.price,
        bedrooms: listing.bedrooms,
        areaSqft: listing.areaSqft,
      },
      avg,
    );

    const media = await this.db.primary
      .select({ status: listingMedia.status, phash: listingMedia.phash, kind: listingMedia.kind })
      .from(listingMedia)
      .where(eq(listingMedia.listingId, listing.id));
    const images = media.filter((m) => m.kind === 'image');
    const photos = {
      ready: images.filter((m) => m.status === 'ready').length,
      processing: images.filter((m) => m.status === 'pending' || m.status === 'processing').length,
      failed: images.filter((m) => m.status === 'failed').length,
    };

    const ownHashes = images.flatMap((m) => (m.phash ? [m.phash] : []));
    const duplicates = await this.duplicates(listing, ownHashes);
    return { warnings, duplicates, photos };
  }

  private async duplicates(
    listing: typeof listings.$inferSelect,
    ownHashes: string[],
  ): Promise<DuplicateMatch[]> {
    const matches = new Map<string, DuplicateMatch>();

    // ۱) عکس: همه‌ی عکس‌های آگهی‌های فعال همان محله با هش
    if (ownHashes.length > 0) {
      const rows = await this.db.primary
        .select({
          publicId: listings.publicId,
          title: listings.title,
          phash: listingMedia.phash,
        })
        .from(listingMedia)
        .innerJoin(listings, eq(listings.id, listingMedia.listingId))
        .where(
          and(
            eq(listings.communityId, listing.communityId),
            eq(listings.status, 'active'),
            isNull(listings.deletedAt),
            ne(listings.id, listing.id),
            eq(listingMedia.kind, 'image'),
            isNotNull(listingMedia.phash),
          ),
        )
        .limit(PHOTO_SCAN_LIMIT);
      for (const row of rows) {
        let best = Number.POSITIVE_INFINITY;
        for (const own of ownHashes) best = Math.min(best, hammingHex(own, row.phash));
        if (best <= SAME_PHOTO_DISTANCE) {
          const existing = matches.get(row.publicId);
          if (!existing || (existing.photoDistance ?? 99) > best) {
            matches.set(row.publicId, {
              publicId: row.publicId,
              title: row.title,
              reason: 'photos',
              photoDistance: best,
            });
          }
        }
      }
    }

    // ۲) مشخصات: همان محله و معامله و خواب، متراژ و قیمت نزدیک، هم‌مکان
    const specRows = await this.db.primary
      .select({ publicId: listings.publicId, title: listings.title, price: listings.price })
      .from(listings)
      .where(
        and(
          eq(listings.communityId, listing.communityId),
          eq(listings.dealType, listing.dealType),
          eq(listings.bedrooms, listing.bedrooms),
          eq(listings.status, 'active'),
          isNull(listings.deletedAt),
          ne(listings.id, listing.id),
          sql`abs(${listings.areaSqft} - ${listing.areaSqft}::numeric) <= ${listing.areaSqft * AREA_TOLERANCE}::numeric`,
          sql`ST_DWithin(${listings.location}, (SELECT location FROM listings WHERE id = ${listing.id}), ${SAME_PLACE_DEGREES}::float8)`,
        ),
      )
      .limit(40);
    for (const row of specRows) {
      if (matches.has(row.publicId)) continue;
      if (Math.abs(row.price - listing.price) <= listing.price * PRICE_TOLERANCE) {
        matches.set(row.publicId, { publicId: row.publicId, title: row.title, reason: 'details' });
      }
    }

    return [...matches.values()].sort(
      (a, b) => Number(b.reason === 'photos') - Number(a.reason === 'photos'),
    );
  }

}
