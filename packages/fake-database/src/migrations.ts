import type { IDBPDatabase, IDBPTransaction } from 'idb';
import {
  type FAKE_DATABASE_STORE_NAMES,
  type FakeDatabaseSchema,
} from './schema.js';

export const FAKE_DATABASE_VERSION = 4;

type MigrationTransaction = IDBPTransaction<
  FakeDatabaseSchema,
  typeof FAKE_DATABASE_STORE_NAMES,
  'versionchange'
>;

export function migrateFakeDatabase(
  database: IDBPDatabase<FakeDatabaseSchema>,
  oldVersion: number,
  transaction: MigrationTransaction
): void {
  if (oldVersion < 1) {
    migrateToVersionOne(database);
  }

  if (oldVersion < 4) {
    clearIncompatibleGameData(transaction);
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

function clearIncompatibleGameData(transaction: MigrationTransaction): void {
  void transaction.objectStore('gameEvents').clear();
  void transaction.objectStore('gameParticipants').clear();
  void transaction.objectStore('games').clear();
  void transaction.objectStore('processedCommands').clear();
}
