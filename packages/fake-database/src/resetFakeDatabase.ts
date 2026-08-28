import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import {
  type FakeDatabaseConnection,
  type FakeDatabaseSchema,
  FAKE_DATABASE_STORE_NAMES,
} from './schema.js';
import {
  FAKE_SEED_CREATED_AT,
  FAKE_USER_IDENTITIES,
  FAKE_USERS,
} from './seed.js';
import {
  type SchemaTableTransaction,
  runSchemaTableTransaction,
} from './Table.js';

export async function resetFakeDatabase(
  database: FakeDatabaseConnection
): Promise<void> {
  await runSchemaTableTransaction(
    database,
    FAKE_DATABASE_STORE_NAMES,
    resetTables
  );

  async function resetTables(
    transaction: SchemaTableTransaction<
      FakeDatabaseSchema,
      typeof FAKE_DATABASE_STORE_NAMES
    >
  ): Promise<void> {
    for (const storeName of FAKE_DATABASE_STORE_NAMES) {
      await transaction.table(storeName).deleteAll();
    }

    const users = transaction.table('users');
    for (const user of FAKE_USERS) {
      await users.insert(user.id, user);
    }

    const userIdentities = transaction.table('userIdentities');
    for (const identity of FAKE_USER_IDENTITIES) {
      await userIdentities.insert(identity.id, identity);
    }

    await transaction.table('runtimeFeatureFlags').insert('application', {
      featureFlags: { ...DEFAULT_RUNTIME_FEATURE_FLAGS },
      id: 'application',
      updatedAt: FAKE_SEED_CREATED_AT,
    });
  }
}
