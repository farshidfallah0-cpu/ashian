import { index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestampColumn } from './columns.js';
import { users } from './users.js';

/** لاگ تغییرناپذیر اقدام‌های حساس (تأیید آگهی، مسدودسازی، تغییر نقش…) */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: uuid().references(() => users.id),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    meta: jsonb().$type<Record<string, unknown>>(),
    ip: text(),
    createdAt: timestampColumn().notNull().defaultNow(),
  },
  (t) => [
    index('audit_entity_idx').on(t.entityType, t.entityId, t.createdAt.desc()),
    index('audit_actor_idx').on(t.actorId, t.createdAt.desc()),
  ],
);
