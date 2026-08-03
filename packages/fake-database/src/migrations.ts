import type { IDBPDatabase } from 'idb';
import type { FakeDatabaseSchema } from './schema.js';

export const FAKE_DATABASE_VERSION = 1;

export function migrateFakeDatabase(
  database: IDBPDatabase<FakeDatabaseSchema>,
  oldVersion: number
): void {
  if (oldVersion < 1) {
    migrateToVersionOne(database);
  }
}

function migrateToVersionOne(database: IDBPDatabase<FakeDatabaseSchema>): void {
  database.createObjectStore('users', { keyPath: 'id' });

  database.createObjectStore('userIdentities', {
    keyPath: 'id',
  });

  database.createObjectStore('authSessions', {
    keyPath: 'id',
  });

  database.createObjectStore('games', { keyPath: 'id' });

  database.createObjectStore('gameParticipants', {
    keyPath: ['gameId', 'userId'],
  });

  database.createObjectStore('processedCommands', {
    keyPath: 'id',
  });

  const gameEvents = database.createObjectStore('gameEvents', {
    keyPath: 'id',
  });
  gameEvents.createIndex('by-game-sequence', ['gameId', 'sequence'], {
    unique: true,
  });

  database.createObjectStore('runtimeFeatureFlags', { keyPath: 'id' });
}
