import { timestamp } from 'drizzle-orm/pg-core';

const ts = () => timestamp({ withTimezone: true, mode: 'date' });

/** ستون‌های زمانی مشترک */
export const timestamps = {
  createdAt: ts().notNull().defaultNow(),
  updatedAt: ts()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** soft delete: رکورد حذف نمی‌شود، فقط علامت می‌خورد. همه‌ی کوئری‌های عمومی باید deletedAt IS NULL بزنند. */
export const softDelete = {
  deletedAt: ts(),
};

export { ts as timestampColumn };
