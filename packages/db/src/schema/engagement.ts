import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestampColumn, timestamps } from './columns.js';
import { alertFrequency, leadStatus, leadType, reportReason, reportStatus } from './enums.js';
import { listings } from './listings.js';
import { agents, users } from './users.js';

export const favorites = pgTable(
  'favorites',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id),
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    createdAt: timestampColumn().notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.listingId] }),
    index('favorites_user_idx').on(t.userId, t.createdAt.desc()),
  ],
);

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
    /** پارامترهای جستجو، همان ساختار query string صفحه‌ی نتایج */
    query: jsonb().$type<Record<string, unknown>>().notNull(),
    frequency: alertFrequency().notNull().default('daily'),
    /** کانال‌های اعلان: sms | email | push */
    channels: text()
      .array()
      .notNull()
      .default(sql`ARRAY['push']::text[]`),
    lastNotifiedAt: timestampColumn(),
    ...timestamps,
  },
  (t) => [
    index('saved_searches_user_idx').on(t.userId),
    // job هشدار فقط جستجوهایی را می‌خواند که هشدار دارند
    index('saved_searches_alert_idx')
      .on(t.frequency, t.lastNotifiedAt)
      .where(sql`${t.frequency} <> 'none'`),
  ],
);

export const comparisons = pgTable(
  'comparisons',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    listingIds: uuid().array().notNull(),
    ...timestamps,
  },
  (t) => [
    index('comparisons_user_idx').on(t.userId),
    check('comparisons_max_four', sql`cardinality(${t.listingIds}) BETWEEN 1 AND 4`),
  ],
);

export const leads = pgTable(
  'leads',
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id),
    agentId: uuid().references(() => agents.id),
    /** کاربر وارد‌شده؛ ممکن است مهمان باشد */
    userId: uuid().references(() => users.id),
    type: leadType().notNull(),
    status: leadStatus().notNull().default('new'),
    name: text(),
    phone: text(),
    message: text(),
    /** اولین باری که وضعیت از «جدید» خارج شد؛ برای میانگین زمان پاسخ مشاور */
    firstResponseAt: timestampColumn(),
    ...timestamps,
  },
  (t) => [
    index('leads_agent_idx').on(t.agentId, t.status, t.createdAt.desc()),
    index('leads_listing_idx').on(t.listingId),
  ],
);

/** بازدید تجمیعی روزانه؛ شمارش از طریق صف انجام می‌شود، نه نوشتن مستقیم به ازای هر بازدید */
export const listingViews = pgTable(
  'listing_views',
  {
    listingId: uuid()
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    day: date({ mode: 'string' }).notNull(),
    views: integer().notNull().default(0),
    uniqueViews: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.listingId, t.day] })],
);

export const reports = pgTable(
  'reports',
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id),
    reporterId: uuid().references(() => users.id),
    reason: reportReason().notNull(),
    details: text(),
    status: reportStatus().notNull().default('open'),
    resolvedBy: uuid().references(() => users.id),
    resolvedAt: timestampColumn(),
    ...timestamps,
  },
  (t) => [
    index('reports_queue_idx').on(t.status, t.createdAt),
    index('reports_listing_idx').on(t.listingId),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    type: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestampColumn(),
    createdAt: timestampColumn().notNull().defaultNow(),
  },
  (t) => [
    index('notifications_user_idx').on(t.userId, t.createdAt.desc()),
    index('notifications_unread_idx')
      .on(t.userId)
      .where(sql`${t.readAt} IS NULL`),
  ],
);
