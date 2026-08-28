import { deleteDB, openDB } from 'idb';
import { FAKE_DATABASE_VERSION, migrateFakeDatabase } from './migrations.js';
import type { FakeDatabaseConnection, FakeDatabaseSchema } from './schema.js';

export const DEFAULT_FAKE_DATABASE_NAME = 'war-chest-fake-database';

export interface OpenFakeDatabaseOptions {
  name?: string;
}

export function openFakeDatabase(
  options: OpenFakeDatabaseOptions = {}
): Promise<FakeDatabaseConnection> {
  const databaseName = options.name ?? DEFAULT_FAKE_DATABASE_NAME;

  return openDB<FakeDatabaseSchema>(databaseName, FAKE_DATABASE_VERSION, {
    upgrade(database, oldVersion, _newVersion, transaction) {
      migrateFakeDatabase(database, oldVersion, transaction);
    },
  });
}

export function deleteFakeDatabase(
  options: OpenFakeDatabaseOptions = {}
): Promise<void> {
  return deleteDB(options.name ?? DEFAULT_FAKE_DATABASE_NAME);
}
