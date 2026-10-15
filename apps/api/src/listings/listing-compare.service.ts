import type { DbClient } from '@ashian/db';
import { alias, and, eq, inArray, isNull, schema } from '@ashian/db';
import { isPublicId, type CompareItem } from '@ashian/shared';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from '../infra/tokens.js';
import { cardQuery, toCard, type ListingCard } from './listing-card.js';

const { listings, locations, listingMedia, listingAmenities, amenities, agents, users } = schema;

const placeLoc = alias(locations, 'place_loc');
const communityLoc = alias(locations, 'community_loc');
const cover = alias(listingMedia, 'cover');

export const MAX_COMPARE = 4;
export const MAX_CARDS = 30;

/** «a,b,c» → شناسه‌های معتبر و یکتا به همان ترتیب (ورودی خراب بی‌صدا حذف می‌شود) */
export function parseIds(raw: unknown, max: number): string[] {
  if (typeof raw !== 'string') return [];
  return [...new Set(raw.split(',').map((s) => s.trim()))].filter(isPublicId).slice(0, max);
}

/**
 * داده‌ی مقایسه و کارت‌های دسته‌ای (برای «بازدیدهای اخیر» و مقایسه). همه عمومی‌اند و فقط
 * آگهی فعال برمی‌گردانند؛ شناسه‌ها از localStorage مرورگر می‌آیند، نه از حساب کاربر.
 */
@Injectable()
export class ListingCompareService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async cards(publicIds: string[]): Promise<ListingCard[]> {
    if (publicIds.length === 0) return [];
    const rows = await cardQuery(this.db.replica).where(
      and(
        inArray(listings.publicId, publicIds),
        eq(listings.status, 'active'),
        isNull(listings.deletedAt),
      ),
    );
    const byId = new Map(rows.map((r) => [r.publicId, toCard(r)]));
    return publicIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  }

  async compare(publicIds: string[]): Promise<CompareItem[]> {
    if (publicIds.length === 0) return [];
    const rows = await this.db.replica
      .select({
        id: listings.id,
        publicId: listings.publicId,
        code: listings.code,
        title: listings.title,
        dealType: listings.dealType,
        propertyType: listings.propertyType,
        status: listings.status,
        price: listings.price,
        pricePerSqft: listings.pricePerSqft,
        bedrooms: listings.bedrooms,
        bathrooms: listings.bathrooms,
        areaSqft: listings.areaSqft,
        floor: listings.floor,
        buildYear: listings.buildYear,
        furnishing: listings.furnishing,
        parkingSpaces: listings.parkingSpaces,
        permitNumber: listings.permitNumber,
        isVerified: listings.isVerified,
        publishedAt: listings.publishedAt,
        communitySlug: communityLoc.slug,
        communityFa: communityLoc.nameFa,
        placeType: placeLoc.type,
        placeFa: placeLoc.nameFa,
        coverId: cover.id,
        coverVariants: cover.variants,
        coverBlurhash: cover.blurhash,
        coverWidth: cover.width,
        coverHeight: cover.height,
        agentId: agents.id,
        agentName: users.name,
        agentVerification: agents.verificationStatus,
      })
      .from(listings)
      .innerJoin(communityLoc, eq(communityLoc.id, listings.communityId))
      .innerJoin(placeLoc, eq(placeLoc.id, listings.locationId))
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
      .leftJoin(users, eq(users.id, agents.userId))
      .where(
        and(
          inArray(listings.publicId, publicIds),
          eq(listings.status, 'active'),
          isNull(listings.deletedAt),
        ),
      );
    if (rows.length === 0) return [];

    const amenityRows = await this.db.replica
      .select({ listingId: listingAmenities.listingId, slug: amenities.slug, nameFa: amenities.nameFa })
      .from(listingAmenities)
      .innerJoin(amenities, eq(amenities.id, listingAmenities.amenityId))
      .where(inArray(listingAmenities.listingId, rows.map((r) => r.id)));

    const byId = new Map<string, CompareItem>(
      rows.map((r) => [
        r.publicId,
        {
          publicId: r.publicId,
          code: r.code,
          title: r.title,
          dealType: r.dealType,
          propertyType: r.propertyType,
          price: r.price,
          pricePerSqft: r.pricePerSqft,
          bedrooms: r.bedrooms,
          bathrooms: r.bathrooms,
          areaSqft: r.areaSqft,
          floor: r.floor,
          buildYear: r.buildYear,
          furnishing: r.furnishing,
          parkingSpaces: r.parkingSpaces,
          permitNumber: r.permitNumber,
          isVerified: r.isVerified,
          status: r.status,
          publishedAt: r.publishedAt?.toISOString() ?? null,
          community: { slug: r.communitySlug, nameFa: r.communityFa },
          tower: r.placeType === 'tower' ? { nameFa: r.placeFa } : null,
          cover: r.coverId
            ? {
                variants: r.coverVariants,
                blurhash: r.coverBlurhash,
                width: r.coverWidth,
                height: r.coverHeight,
              }
            : null,
          agent: r.agentId
            ? {
                id: r.agentId,
                name: r.agentName ?? 'مشاور',
                isVerified: r.agentVerification === 'verified',
              }
            : null,
          amenities: amenityRows
            .filter((a) => a.listingId === r.id)
            .map((a) => ({ slug: a.slug, nameFa: a.nameFa })),
        },
      ]),
    );
    return publicIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  }
}
