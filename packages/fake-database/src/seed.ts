import type {
  FakeDatabaseConnection,
  FakeDatabaseSchema,
  FakeFeatureFlags,
  FakeRuntimeFeatureFlags,
  FakeUser,
  FakeUserIdentity,
} from './schema.js';
import {
  type SchemaTableTransaction,
  runSchemaTableTransaction,
} from './Table.js';

export const FAKE_SEED_CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const SEED_STORE_NAMES = [
  'users',
  'userIdentities',
  'runtimeFeatureFlags',
] as const;

export const FAKE_SEED_IDENTIFIERS = {
  googleIdentity: '50000000-0000-4000-8000-000000000001',
  googleUser: '10000000-0000-4000-8000-000000000001',
  telegramIdentity: '50000000-0000-4000-8000-000000000002',
  telegramUser: '10000000-0000-4000-8000-000000000002',
  yandexIdentity: '50000000-0000-4000-8000-000000000003',
  yandexUser: '10000000-0000-4000-8000-000000000003',
} as const;

export const FAKE_PROVIDER_SUBJECTS = {
  google: 'fake-google-user',
  telegram: 'fake-telegram-user',
  yandex: 'fake-yandex-user',
} as const;

export const DEFAULT_FAKE_FEATURE_FLAGS: FakeFeatureFlags = {
  gameHistory: true,
  optimisticMoves: false,
  spectatorMode: true,
};

export const FAKE_USERS = [
  {
    createdAt: FAKE_SEED_CREATED_AT,
    displayName: 'G User',
    id: FAKE_SEED_IDENTIFIERS.googleUser,
  },
  {
    createdAt: FAKE_SEED_CREATED_AT,
    displayName: 'T User',
    id: FAKE_SEED_IDENTIFIERS.telegramUser,
  },
  {
    createdAt: FAKE_SEED_CREATED_AT,
    displayName: 'Y User',
    id: FAKE_SEED_IDENTIFIERS.yandexUser,
  },
] satisfies readonly FakeUser[];

export const FAKE_USER_IDENTITIES = [
  {
    createdAt: FAKE_SEED_CREATED_AT,
    id: FAKE_SEED_IDENTIFIERS.googleIdentity,
    provider: 'google',
    providerSubject: FAKE_PROVIDER_SUBJECTS.google,
    userId: FAKE_SEED_IDENTIFIERS.googleUser,
  },
  {
    createdAt: FAKE_SEED_CREATED_AT,
    id: FAKE_SEED_IDENTIFIERS.telegramIdentity,
    provider: 'telegram',
    providerSubject: FAKE_PROVIDER_SUBJECTS.telegram,
    userId: FAKE_SEED_IDENTIFIERS.telegramUser,
  },
  {
    createdAt: FAKE_SEED_CREATED_AT,
    id: FAKE_SEED_IDENTIFIERS.yandexIdentity,
    provider: 'yandex',
    providerSubject: FAKE_PROVIDER_SUBJECTS.yandex,
    userId: FAKE_SEED_IDENTIFIERS.yandexUser,
  },
] satisfies readonly FakeUserIdentity[];

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

  const userIdentities = transaction.table('userIdentities');
  for (const identity of FAKE_USER_IDENTITIES) {
    if ((await userIdentities.get(identity.id)) === undefined) {
      await userIdentities.insert(identity.id, identity);
    } else if (overwriteExisting) {
      await userIdentities.update(identity.id, identity);
    }
  }

  const runtimeFeatureFlags = transaction.table('runtimeFeatureFlags');
  const featureFlagsRecord: FakeRuntimeFeatureFlags = {
    featureFlags: { ...DEFAULT_FAKE_FEATURE_FLAGS },
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
