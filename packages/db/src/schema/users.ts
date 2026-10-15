import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { softDelete, timestampColumn, timestamps } from './columns.js';
import { userRole, userStatus, verificationStatus } from './enums.js';

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    /** E.164 بدون + ؛ مثل 971501234567 */
    phone: text().notNull(),
    name: text(),
    email: text(),
    role: userRole().notNull().default('user'),
    status: userStatus().notNull().default('active'),
    avatarKey: text(),
    lastLoginAt: timestampColumn(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [uniqueIndex('users_phone_uq').on(t.phone), index('users_role_idx').on(t.role)],
);

export const agencies = pgTable(
  'agencies',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    nameEn: text(),
    slug: text().notNull(),
    logoKey: text(),
    description: text(),
    /** شماره‌ی مجوز شرکت (ORN) */
    licenseNumber: text(),
    verificationStatus: verificationStatus().notNull().default('pending'),
    /** مدیر آژانس: تیم و آمار تجمیعی را مدیریت می‌کند */
    managerUserId: uuid().references(() => users.id),
    ...timestamps,
    ...softDelete,
  },
  (t) => [uniqueIndex('agencies_slug_uq').on(t.slug), index('agencies_manager_idx').on(t.managerUserId)],
);

export const agents = pgTable(
  'agents',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    agencyId: uuid().references(() => agencies.id),
    /** شماره‌ی کارت مشاور (BRN) */
    brn: text(),
    bio: text(),
    languages: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** شناسه‌ی محله‌های فعالیت */
    areaIds: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    whatsapp: text(),
    verificationStatus: verificationStatus().notNull().default('pending'),
    /** میانگین امتیاز ۰ تا ۵ با یک رقم اعشار */
    rating: numeric({ precision: 2, scale: 1, mode: 'number' }),
    reviewCount: integer().notNull().default(0),
    /** میانگین زمان پاسخ به lead به دقیقه */
    avgResponseMinutes: smallint(),
    isTopAgent: boolean().notNull().default(false),
    activeListingCount: integer().notNull().default(0),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex('agents_user_uq').on(t.userId),
    index('agents_agency_idx').on(t.agencyId),
    index('agents_top_idx').on(t.isTopAgent, t.rating),
  ],
);
