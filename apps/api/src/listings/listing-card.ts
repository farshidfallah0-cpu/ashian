import type { Database } from '@ashian/db';
import { alias, and, eq, schema } from '@ashian/db';
import type {
  DealType,
  Furnishing,
  ListingStatus,
  ListingTier,
  MediaVariants,
  PropertyType,
} from '@ashian/shared';

const { listings, locations, listingMedia, agents, users } = schema;

const communityLoc = alias(locations, 'community_loc');
const cover = alias(listingMedia, 'cover');
const agentUser = alias(users, 'agent_user');

export interface ListingCard {
  publicId: string;
  code: number;
  dealType: DealType;
  propertyType: PropertyType;
  status: ListingStatus;
  tier: ListingTier;
  isVerified: boolean;
  title: string;
  price: number;
  pricePerSqft: number;
  bedrooms: number;
  bathrooms: number;
  areaSqft: number;
  furnishing: Furnishing;
  publishedAt: Date | null;
  expiresAt: Date | null;
  community: { slug: string; nameFa: string; nameEn: string };
  cover: {
    variants: MediaVariants | null;
    blurhash: string | null;
    width: number | null;
    height: number | null;
  } | null;
  agent: {
    id: string;
    name: string;
    avatarKey: string | null;
    isVerified: boolean;
    isTopAgent: boolean;
  } | null;
}

const cardColumns = {
  publicId: listings.publicId,
  code: listings.code,
  dealType: listings.dealType,
  propertyType: listings.propertyType,
  status: listings.status,
  tier: listings.tier,
  isVerified: listings.isVerified,
  title: listings.title,
  price: listings.price,
  pricePerSqft: listings.pricePerSqft,
  bedrooms: listings.bedrooms,
  bathrooms: listings.bathrooms,
  areaSqft: listings.areaSqft,
  furnishing: listings.furnishing,
  publishedAt: listings.publishedAt,
  expiresAt: listings.expiresAt,
  communitySlug: communityLoc.slug,
  communityFa: communityLoc.nameFa,
  communityEn: communityLoc.nameEn,
  coverId: cover.id,
  coverVariants: cover.variants,
  coverBlurhash: cover.blurhash,
  coverWidth: cover.width,
  coverHeight: cover.height,
  agentId: agents.id,
  agentName: agentUser.name,
  agentAvatar: agentUser.avatarKey,
  agentVerification: agents.verificationStatus,
  agentTop: agents.isTopAgent,
};

/** کوئری پایه‌ی کارت آگهی؛ فقط where/orderBy/limit به آن اضافه کنید. */
export function cardQuery(db: Database) {
  return db
    .select(cardColumns)
    .from(listings)
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
    .leftJoin(agentUser, eq(agentUser.id, agents.userId));
}

export function toCard(
  r: Awaited<ReturnType<ReturnType<typeof cardQuery>['limit']>>[number],
): ListingCard {
  return {
    publicId: r.publicId,
    code: r.code,
    dealType: r.dealType,
    propertyType: r.propertyType,
    status: r.status,
    tier: r.tier,
    isVerified: r.isVerified,
    title: r.title,
    price: r.price,
    pricePerSqft: r.pricePerSqft,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    areaSqft: r.areaSqft,
    furnishing: r.furnishing,
    publishedAt: r.publishedAt,
    expiresAt: r.expiresAt,
    community: { slug: r.communitySlug, nameFa: r.communityFa, nameEn: r.communityEn },
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
          avatarKey: r.agentAvatar,
          isVerified: r.agentVerification === 'verified',
          isTopAgent: r.agentTop ?? false,
        }
      : null,
  };
}
