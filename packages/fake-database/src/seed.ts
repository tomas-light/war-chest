import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import type {
  FakeDatabaseConnection,
  FakeDatabaseSchema,
  FakeRuntimeFeatureFlags,
  FakeUser,
} from './schema.js';
import {
  type SchemaTableTransaction,
  runSchemaTableTransaction,
} from './Table.js';

export const FAKE_SEED_CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const SEED_STORE_NAMES = ['users', 'runtimeFeatureFlags'] as const;

export const FAKE_SEED_IDENTIFIERS = {
  firstUser: '10000000-0000-4000-8000-000000000001',
  secondUser: '10000000-0000-4000-8000-000000000002',
  thirdUser: '10000000-0000-4000-8000-000000000003',
} as const;

export const FAKE_USERS = [
  {
    avatarDataUrl: null,
    createdAt: FAKE_SEED_CREATED_AT,
    avatarPresetId: 'archer',
    displayName: 'Archer',
    email: 'archer@example.com',
    id: FAKE_SEED_IDENTIFIERS.firstUser,
  },
  {
    avatarDataUrl: null,
    createdAt: FAKE_SEED_CREATED_AT,
    avatarPresetId: 'cavalry',
    displayName: 'Cavalry',
    email: 'cavalry@example.com',
    id: FAKE_SEED_IDENTIFIERS.secondUser,
  },
  {
    avatarDataUrl: null,
    createdAt: FAKE_SEED_CREATED_AT,
    avatarPresetId: 'warrior-priest',
    displayName: 'Warrior Priest',
    email: 'priest@example.com',
    id: FAKE_SEED_IDENTIFIERS.thirdUser,
  },
] satisfies readonly FakeUser[];

export async function seedFakeDatabase(
  database: FakeDatabaseConnection
): Promise<void> {
  await runSchemaTableTransaction(
    database,
    SEED_STORE_NAMES,
    async (transaction) => writeSeedFixtures(transaction, false)
  );
}

async function writeSeedFixtures(
  transaction: SeedTransaction,
  overwriteExisting: boolean
): Promise<void> {
  const users = transaction.table('users');
  for (const user of FAKE_USERS) {
    if ((await users.get(user.id)) === undefined) {
      await users.insert(user.id, user);
    } else if (overwriteExisting) {
      await users.update(user.id, user);
    }
  }

  const runtimeFeatureFlags = transaction.table('runtimeFeatureFlags');
  const featureFlagsRecord: FakeRuntimeFeatureFlags = {
    featureFlags: { ...DEFAULT_RUNTIME_FEATURE_FLAGS },
    id: 'application',
    updatedAt: FAKE_SEED_CREATED_AT,
  };

  if ((await runtimeFeatureFlags.get('application')) === undefined) {
    await runtimeFeatureFlags.insert('application', featureFlagsRecord);
  } else if (overwriteExisting) {
    await runtimeFeatureFlags.update('application', featureFlagsRecord);
  }
}

type SeedTransaction = SchemaTableTransaction<
  FakeDatabaseSchema,
  typeof SEED_STORE_NAMES
>;
