import { randomUUID } from 'node:crypto';
import type {
  AuthSession,
  Game,
  GameEvent,
  GameParticipant,
  ProcessedCommand,
  User,
} from '@war-chest/database';
import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import 'fake-indexeddb/auto';
import { type DBSchema, openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  type FakeDatabase,
  createFakeDatabase,
  deleteFakeDatabase,
  FAKE_DATABASE_VERSION,
  FAKE_SEED_IDENTIFIERS,
} from '../src/index.js';

const LEGACY_DATABASE_VERSION = 6;
const LEGACY_SESSION_ID = 'legacy-session';
const LEGACY_GAME_ID = 'legacy-game';
const LEGACY_CREATED_AT = new Date('2026-09-14T16:00:00.000Z');

interface LegacyRuntimeFeatureFlags {
  gameHistory: boolean;
  optimisticMoves: boolean;
  spectatorMode: boolean;
}

interface LegacyDatabaseSchema extends DBSchema {
  authSessions: {
    key: string;
    value: Omit<AuthSession, 'tokenHash'>;
  };
  gameEvents: {
    indexes: {
      'by-game-sequence': [string, number];
    };
    key: string;
    value: GameEvent;
  };
  gameParticipants: {
    key: [string, string];
    value: GameParticipant;
  };
  games: {
    key: string;
    value: Game;
  };
  processedCommands: {
    key: string;
    value: ProcessedCommand;
  };
  runtimeFeatureFlags: {
    key: 'application';
    value: {
      featureFlags: LegacyRuntimeFeatureFlags;
      id: 'application';
      updatedAt: Date;
    };
  };
  users: {
    key: string;
    value: User;
  };
}

describe('fake database schema 6 migration', () => {
  let database: FakeDatabase;
  let databaseName: string;

  beforeEach(async () => {
    databaseName = `war-chest-migration-${randomUUID()}`;
    const legacyDatabase = await openDB<LegacyDatabaseSchema>(
      databaseName,
      LEGACY_DATABASE_VERSION,
      {
        upgrade(connection) {
          connection.createObjectStore('users', { keyPath: 'id' });
          connection.createObjectStore('authSessions', { keyPath: 'id' });
          connection.createObjectStore('games', { keyPath: 'id' });
          connection.createObjectStore('gameParticipants', {
            keyPath: ['gameId', 'userId'],
          });
          connection.createObjectStore('processedCommands', {
            keyPath: 'id',
          });
          const gameEvents = connection.createObjectStore('gameEvents', {
            keyPath: 'id',
          });
          gameEvents.createIndex('by-game-sequence', ['gameId', 'sequence'], {
            unique: true,
          });
          connection.createObjectStore('runtimeFeatureFlags', {
            keyPath: 'id',
          });
        },
      }
    );
    const legacyTransaction = legacyDatabase.transaction(
      ['authSessions', 'games', 'runtimeFeatureFlags', 'users'],
      'readwrite'
    );

    await legacyTransaction.objectStore('users').put({
      createdAt: LEGACY_CREATED_AT,
      displayName: 'Persisted Archer',
      email: 'archer@example.com',
      id: FAKE_SEED_IDENTIFIERS.firstUser,
    });
    await legacyTransaction.objectStore('authSessions').put({
      createdAt: LEGACY_CREATED_AT,
      expiresAt: new Date('2026-09-15T16:00:00.000Z'),
      id: LEGACY_SESSION_ID,
      revokedAt: null,
      userId: FAKE_SEED_IDENTIFIERS.firstUser,
    });
    await legacyTransaction.objectStore('games').put({
      cardSelectionMode: 'random',
      createdAt: LEGACY_CREATED_AT,
      currentVersion: 1,
      expansions: [],
      finishedAt: null,
      format: 'duel',
      id: LEGACY_GAME_ID,
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    });
    await legacyTransaction.objectStore('runtimeFeatureFlags').put({
      featureFlags: {
        gameHistory: true,
        optimisticMoves: false,
        spectatorMode: true,
      },
      id: 'application',
      updatedAt: LEGACY_CREATED_AT,
    });
    await legacyTransaction.done;
    legacyDatabase.close();

    database = await createFakeDatabase({ name: databaseName });
  });

  afterEach(async () => {
    database.close();
    await deleteFakeDatabase({ name: databaseName });
  });

  test('upgrades the database to the current schema version', () => {
    expect(database.connection.version).toBe(FAKE_DATABASE_VERSION);
  });

  test('clears games that contain an incompatible feature flag snapshot', async () => {
    await expect(database.game.getAll()).resolves.toEqual([]);
  });

  test('replaces incomplete runtime feature flags with current defaults', async () => {
    await expect(database.featureFlags.getApplication()).resolves.toEqual(
      DEFAULT_RUNTIME_FEATURE_FLAGS
    );
  });

  test('recreates users and removes auth sessions', async () => {
    await expect(
      database.users.getById(FAKE_SEED_IDENTIFIERS.firstUser)
    ).resolves.toMatchObject({ displayName: 'Archer' });
    await expect(
      database.sessions.getById(LEGACY_SESSION_ID)
    ).resolves.toBeNull();
  });
});
