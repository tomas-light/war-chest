import type {
  AuthSession,
  Game,
  GameEvent,
  GameParticipant,
  ProcessedCommand,
  User,
} from '@war-chest/database';
import type { RuntimeFeatureFlags } from '@war-chest/feature-flags';
import type { DBSchema, IDBPDatabase } from 'idb';

export const FAKE_DATABASE_STORE_NAMES = [
  'authSessions',
  'gameEvents',
  'gameParticipants',
  'games',
  'processedCommands',
  'runtimeFeatureFlags',
  'users',
] as const;

export type FakeGameStatus = Game['status'];
export type FakeUser = User & {
  avatarDataUrl?: string | null;
};
export type FakeAuthSession = Omit<AuthSession, 'tokenHash'>;
export type FakeGame = Game;
export type FakeGameParticipant = GameParticipant;
export type FakeProcessedCommand = ProcessedCommand;
export type FakeGameEvent = GameEvent;

export interface FakeRuntimeFeatureFlags {
  featureFlags: RuntimeFeatureFlags;
  id: 'application';
  updatedAt: Date;
}

export interface FakeDatabaseSchema extends DBSchema {
  authSessions: {
    key: string;
    value: FakeAuthSession;
  };
  gameEvents: {
    indexes: {
      'by-game-sequence': [string, number];
    };
    key: string;
    value: FakeGameEvent;
  };
  gameParticipants: {
    key: [string, string];
    value: FakeGameParticipant;
  };
  games: {
    key: string;
    value: FakeGame;
  };
  processedCommands: {
    key: string;
    value: FakeProcessedCommand;
  };
  runtimeFeatureFlags: {
    key: 'application';
    value: FakeRuntimeFeatureFlags;
  };
  users: {
    key: string;
    value: FakeUser;
  };
}

export type FakeDatabaseConnection = IDBPDatabase<FakeDatabaseSchema>;
