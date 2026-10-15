import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { timestampColumn, timestamps } from './columns.js';
import { listings } from './listings.js';
import { users } from './users.js';

/** هر گفتگو به یک آگهی وصل است؛ یک جفت (کاربر، آگهی) فقط یک گفتگو دارد */
export const conversations = pgTable(
  'conversations',
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listings.id),
    seekerId: uuid()
      .notNull()
      .references(() => users.id),
    /** مشاور یا مالک آگهی */
    responderId: uuid()
      .notNull()
      .references(() => users.id),
    lastMessageAt: timestampColumn().notNull().defaultNow(),
    seekerBlockedAt: timestampColumn(),
    responderBlockedAt: timestampColumn(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('conversations_pair_uq').on(t.listingId, t.seekerId),
    index('conversations_seeker_idx').on(t.seekerId, t.lastMessageAt.desc()),
    index('conversations_responder_idx').on(t.responderId, t.lastMessageAt.desc()),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderId: uuid()
      .notNull()
      .references(() => users.id),
    body: text().notNull().default(''),
    attachmentKey: text(),
    /** برچسب‌های ضداسپم (مثل phone_in_first_message) */
    flags: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    meta: jsonb().$type<Record<string, unknown>>(),
    readAt: timestampColumn(),
    createdAt: timestampColumn().notNull().defaultNow(),
  },
  (t) => [
    index('messages_conversation_idx').on(t.conversationId, t.createdAt),
    index('messages_unread_idx')
      .on(t.conversationId)
      .where(sql`${t.readAt} IS NULL`),
  ],
);
