import { relations } from 'drizzle-orm';
import { authSessions, userAvatars, users } from './auth.js';
import {
  activeGamePlayers,
  gameEvents,
  gameParticipants,
  games,
  processedCommands,
} from './games.js';

export const usersRelations = relations(users, ({ many, one }) => ({
  avatar: one(userAvatars),
  sessions: many(authSessions),
  participations: many(gameParticipants),
  activeGame: one(activeGamePlayers),
  processedCommands: many(processedCommands),
}));

export const userAvatarsRelations = relations(userAvatars, ({ one }) => ({
  user: one(users, {
    fields: [userAvatars.userId],
    references: [users.id],
  }),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, {
    fields: [authSessions.userId],
    references: [users.id],
  }),
}));

export const gamesRelations = relations(games, ({ many }) => ({
  activePlayers: many(activeGamePlayers),
  participants: many(gameParticipants),
  processedCommands: many(processedCommands),
  events: many(gameEvents),
}));

export const activeGamePlayersRelations = relations(
  activeGamePlayers,
  ({ one }) => ({
    game: one(games, {
      fields: [activeGamePlayers.gameId],
      references: [games.id],
    }),
    user: one(users, {
      fields: [activeGamePlayers.userId],
      references: [users.id],
    }),
  })
);

export const gameParticipantsRelations = relations(
  gameParticipants,
  ({ one }) => ({
    game: one(games, {
      fields: [gameParticipants.gameId],
      references: [games.id],
    }),
    user: one(users, {
      fields: [gameParticipants.userId],
      references: [users.id],
    }),
  })
);

export const processedCommandsRelations = relations(
  processedCommands,
  ({ many, one }) => ({
    game: one(games, {
      fields: [processedCommands.gameId],
      references: [games.id],
    }),
    user: one(users, {
      fields: [processedCommands.userId],
      references: [users.id],
    }),
    events: many(gameEvents),
  })
);

export const gameEventsRelations = relations(gameEvents, ({ one }) => ({
  game: one(games, {
    fields: [gameEvents.gameId],
    references: [games.id],
  }),
  command: one(processedCommands, {
    fields: [gameEvents.commandId],
    references: [processedCommands.id],
  }),
}));
