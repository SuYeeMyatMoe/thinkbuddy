import { integer, sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';

export const missions = sqliteTable('missions', {
  id: text('id').notNull(), ownerId: text('owner_id').notNull(),
  title: text('title').notNull(), data: text('data').notNull(),
  revision: integer('revision').notNull().default(1), updatedAt: text('updated_at').notNull(),
}, table => [primaryKey({ columns: [table.ownerId, table.id] })]);
export const councilCommands = sqliteTable('council_commands', {
  ownerId: text('owner_id').notNull(), id: text('id').notNull(),
  fingerprint: text('fingerprint').notNull(), result: text('result'),
  createdAt: text('created_at').notNull(),
}, table => [primaryKey({ columns: [table.ownerId, table.id] })]);
