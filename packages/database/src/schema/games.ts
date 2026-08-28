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

export type JsonValue =
  boolean | number | string | null | { [key: string]: JsonValue } | JsonValue[];

export const gameStatus = pgEnum('game_status', [
  'waiting',
  'active',
  'finished',
]);

export const gameTeam = pgEnum('game_team', ['black', 'white']);

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    status: gameStatus('status').notNull().default('waiting'),
    winnerTeam: gameTeam('winner_team'),
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
    seat: integer('seat').notNull(),
    team: gameTeam('team').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'game_participants_game_user_pk',
      columns: [table.gameId, table.userId],
    }),
    uniqueIndex('game_participants_game_team_seat_unique').on(
      table.gameId,
      table.team,
      table.seat
    ),
    index('game_participants_user_history_index').on(
      table.userId,
      table.gameId
    ),
    check('game_participants_seat_positive', sql`${table.seat} > 0`),
  ]
);

export const activeGamePlayers = pgTable(
  'active_game_players',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'restrict' }),
    gameId: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
  },
  (table) => [index('active_game_players_game_id_index').on(table.gameId)]
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
    requestHash: text('request_hash').notNull(),
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
    check(
      'processed_commands_request_hash_format',
      sql`${table.requestHash} ~ '^[0-9a-f]{64}$'`
    ),
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
export type ActiveGamePlayer = typeof activeGamePlayers.$inferSelect;
export type NewActiveGamePlayer = typeof activeGamePlayers.$inferInsert;
export type ProcessedCommand = typeof processedCommands.$inferSelect;
export type NewProcessedCommand = typeof processedCommands.$inferInsert;
export type GameEvent = typeof gameEvents.$inferSelect;
export type NewGameEvent = typeof gameEvents.$inferInsert;
