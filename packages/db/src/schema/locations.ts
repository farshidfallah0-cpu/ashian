import {
  type AnyPgColumn,
  geometry,
  index,
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns.js';
import { amenityCategory, locationType } from './enums.js';

/**
 * مکان‌ها: امارت ← محله (community) ← برج/مجتمع.
 * همه‌ی فرزندها از parentId به والد وصل‌اند؛ path برای فیلتر سریع زیرمجموعه است.
 */
export const locations = pgTable(
  'locations',
  {
    id: uuid().primaryKey().defaultRandom(),
    parentId: uuid().references((): AnyPgColumn => locations.id),
    type: locationType().notNull(),
    /** slug لاتین یکتا در سطح والد؛ برای URL */
    slug: text().notNull(),
    nameFa: text().notNull(),
    nameEn: text().notNull(),
    /** نام‌های جایگزین برای جستجو (املای دیگر، مخفف‌ها): JVC، مارینا … */
    aliases: text().array().notNull().default([]),
    /** مسیر کامل: «dubai/dubai-marina/marina-gate-1» */
    path: text().notNull(),
    center: geometry({ type: 'point', mode: 'xy', srid: 4326 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('locations_path_uq').on(t.path),
    index('locations_parent_idx').on(t.parentId, t.type),
    index('locations_type_idx').on(t.type),
    index('locations_center_gix').using('gist', t.center),
  ],
);

export const amenities = pgTable(
  'amenities',
  {
    id: serial().primaryKey(),
    slug: text().notNull(),
    nameFa: text().notNull(),
    nameEn: text().notNull(),
    category: amenityCategory().notNull(),
    /** نام آیکون Phosphor */
    icon: text(),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [uniqueIndex('amenities_slug_uq').on(t.slug)],
);
