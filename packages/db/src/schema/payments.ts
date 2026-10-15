import { sql } from 'drizzle-orm';
import { bigint, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestampColumn, timestamps } from './columns.js';
import { listings } from './listings.js';
import { users } from './users.js';

/**
 * سفارش ارتقا (پرداخت). لایه‌ی پرداخت انتزاعی است: provider (mock، درگاه واقعی) و providerRef
 * همین‌جا ثبت می‌شوند و منطق برنامه فقط به وضعیت سفارش نگاه می‌کند.
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    listingId: uuid()
      .notNull()
      .references(() => listings.id),
    /** نوع محصول؛ فعلاً فقط «featured» */
    kind: text().notNull(),
    days: integer().notNull(),
    /** مبلغ به واحد پول بازار (درهم، عدد صحیح) */
    amount: bigint({ mode: 'number' }).notNull(),
    currency: text().notNull(),
    /** pending | paid | failed | cancelled */
    status: text().notNull().default('pending'),
    provider: text().notNull(),
    providerRef: text(),
    paidAt: timestampColumn(),
    ...timestamps,
  },
  (t) => [
    index('orders_user_idx').on(t.userId, t.createdAt.desc()),
    index('orders_listing_idx').on(t.listingId),
    index('orders_pending_idx')
      .on(t.createdAt)
      .where(sql`${t.status} = 'pending'`),
  ],
);