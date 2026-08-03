import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  JsonPrimitive | { [key: string]: JsonValue } | JsonValue[];

export const gameStatus = pgEnum('game_status', [
  'waiting',
  'active',
  'finished',
]);

export const participantRole = pgEnum('participant_role', [
  'player',
  'spectator',
]);

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: gameStatus('status').notNull().default('waiting'),
    currentVersion: integer('current_version').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'games_current_version_nonnegative',
      sql`${table.currentVersion} >= 0`
    ),
    index('games_status_index').on(table.status),
  ]
);

export const gameParticipants = pgTable(
  'game_participants',
  {
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    role: participantRole('role').notNull(),
    seat: integer('seat'),
    result: text('result'),
  },
  (table) => [
    primaryKey({
      name: 'game_participants_game_user_pk',
      columns: [table.gameId, table.userId],
    }),
    uniqueIndex('game_participants_game_seat_unique').on(
      table.gameId,
      table.seat
    ),
    index('game_participants_user_history_index').on(
      table.userId,
      table.role,
      table.gameId
    ),
    check(
      'game_participants_role_seat_check',
      sql`(${table.role} = 'player' AND ${table.seat} IS NOT NULL) OR (${table.role} = 'spectator' AND ${table.seat} IS NULL)`
    ),
    check(
      'game_participants_seat_positive',
      sql`${table.seat} IS NULL OR ${table.seat} > 0`
    ),
  ]
);

export const processedCommands = pgTable(
  'processed_commands',
  {
    id: uuid('id').primaryKey(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    commandType: text('command_type').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('processed_commands_game_processed_at_index').on(
      table.gameId,
      table.processedAt
    ),
    index('processed_commands_user_id_index').on(table.userId),
  ]
);

export const gameEvents = pgTable(
  'game_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    commandId: uuid('command_id').references(() => processedCommands.id, {
      onDelete: 'restrict',
    }),
    sequence: integer('sequence').notNull(),
    type: text('type').notNull(),
    version: integer('version').notNull(),
    payload: jsonb('payload').$type<JsonValue>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('game_events_game_sequence_unique').on(
      table.gameId,
      table.sequence
    ),
    index('game_events_command_id_index').on(table.commandId),
    check('game_events_sequence_positive', sql`${table.sequence} > 0`),
    check('game_events_version_positive', sql`${table.version} > 0`),
  ]
);

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type GameParticipant = typeof gameParticipants.$inferSelect;
export type NewGameParticipant = typeof gameParticipants.$inferInsert;
export type ProcessedCommand = typeof processedCommands.$inferSelect;
export type NewProcessedCommand = typeof processedCommands.$inferInsert;
export type GameEvent = typeof gameEvents.$inferSelect;
export type NewGameEvent = typeof gameEvents.$inferInsert;
