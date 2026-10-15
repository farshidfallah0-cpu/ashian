import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  geometry,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { MediaVariants } from '@ashian/shared';
import { softDelete, timestampColumn, timestamps } from './columns.js';
import {
  dealType,
  furnishing,
  listingStatus,
  listingTier,
  mediaKind,
  mediaStatus,
  propertyType,
} from './enums.js';
import { amenities, locations } from './locations.js';
import { agents, users } from './users.js';

export const listings = pgTable(
  'listings',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** شناسه‌ی عمومی کوتاه و غیرقابل حدس برای URL */
    publicId: text().notNull(),
    /** کد عددی قابل‌گفتن برای جستجو و تلفن («کد ۴۸۲۱۹») */
    code: integer().generatedAlwaysAsIdentity({ startWith: 10000 }).notNull(),

    ownerId: uuid()
      .notNull()
      .references(() => users.id),
    agentId: uuid().references(() => agents.id),

    dealType: dealType().notNull(),
    propertyType: propertyType().notNull(),
    status: listingStatus().notNull().default('draft'),
    tier: listingTier().notNull().default('standard'),
    /** شناسه‌ی تأییدشده توسط تیم (نشان «تأییدشده») */
    isVerified: boolean().notNull().default(false),

    /** دقیق‌ترین مکان؛ communityId همیشه پر است تا فیلتر محله بدون join سریع باشد */
    locationId: uuid()
      .notNull()
      .references(() => locations.id),
    communityId: uuid()
      .notNull()
      .references(() => locations.id),
    location: geometry({ type: 'point', mode: 'xy', srid: 4326 }).notNull(),

    title: text().notNull(),
    description: text().notNull().default(''),

    /** درهم. اجاره: سالانه | فروش: کل | رهن کامل: مبلغ رهن | کوتاه‌مدت: هر شب */
    price: bigint({ mode: 'number' }).notNull(),
    pricePerSqft: integer().notNull(),
    rentCheques: smallint()
      .array()
      .notNull()
      .default(sql`'{}'::smallint[]`),
    deposit: bigint({ mode: 'number' }),

    bedrooms: smallint().notNull(),
    bathrooms: smallint().notNull(),
    areaSqft: integer().notNull(),
    floor: smallint(),
    buildYear: smallint(),
    furnishing: furnishing().notNull(),
    parkingSpaces: smallint().notNull().default(0),
    permitNumber: text(),

    /** شمارنده‌های denormalized برای رتبه‌بندی و نمایش */
    photoCount: smallint().notNull().default(0),
    qualityScore: smallint().notNull().default(0),

    publishedAt: timestampColumn(),
    expiresAt: timestampColumn(),
    /** پایان ارتقای «ویژه» (خالی = بدون انقضا؛ مثلاً اعطای ادمین) */
    featuredUntil: timestampColumn(),
    reviewedAt: timestampColumn(),
    rejectionReason: text(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex('listings_public_id_uq').on(t.publicId),
    uniqueIndex('listings_code_uq').on(t.code),
    // فید اصلی: فعال‌ها به ترتیب تازگی
    index('listings_active_feed_idx')
      .on(t.status, t.publishedAt.desc())
      .where(sql`${t.deletedAt} IS NULL`),
    // فیلتر محله + نوع معامله (پرتکرارترین ترکیب)
    index('listings_community_deal_idx')
      .on(t.communityId, t.dealType, t.status, t.price)
      .where(sql`${t.deletedAt} IS NULL`),
    index('listings_agent_status_idx').on(t.agentId, t.status),
    index('listings_owner_idx').on(t.ownerId, t.status),
    index('listings_review_queue_idx')
      .on(t.createdAt)
      .where(sql`${t.status} = 'pending_review'`),
    index('listings_location_gix').using('gist', t.location),
  ],
);

export const listingAmenities = pgTable(
  'listing_amenities',
  {
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    amenityId: integer()
      .notNull()
      .references(() => amenities.id),
  },
  (t) => [
    primaryKey({ columns: [t.listingId, t.amenityId] }),
    index('listing_amenities_amenity_idx').on(t.amenityId),
  ],
);

export const listingMedia = pgTable(
  'listing_media',
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    kind: mediaKind().notNull().default('image'),
    status: mediaStatus().notNull().default('pending'),
    /** کلید فایل اصلی در ذخیره‌سازی (آپلود مستقیم) */
    originalKey: text().notNull(),
    /** کلید فایل‌های پردازش‌شده: variants.avif[640] = «listings/…/640.avif» */
    variants: jsonb().$type<MediaVariants>(),
    width: integer(),
    height: integer(),
    blurhash: text(),
    /** هش ادراکی ۶۴ بیتی (dHash، ۱۶ رقم hex) برای تشخیص عکس تکراری بین آگهی‌ها */
    phash: text(),
    /** ترتیب نمایش؛ صفر = عکس اصلی */
    position: smallint().notNull().default(0),
    altText: text(),
    ...timestamps,
  },
  (t) => [
    index('listing_media_listing_idx').on(t.listingId, t.position),
    index('listing_media_pending_idx')
      .on(t.status)
      .where(sql`${t.status} IN ('pending', 'processing')`),
  ],
);

export const priceHistory = pgTable(
  'price_history',
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    price: bigint({ mode: 'number' }).notNull(),
    changedAt: timestampColumn().notNull().defaultNow(),
  },
  (t) => [index('price_history_listing_idx').on(t.listingId, t.changedAt)],
);
