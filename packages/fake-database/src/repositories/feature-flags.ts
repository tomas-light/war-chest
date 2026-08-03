import type { FakeDatabaseConnection, FakeFeatureFlags } from '../schema.js';
import { createSchemaTable, runSchemaTableTransaction } from '../table.js';

const APPLICATION_FEATURE_FLAGS_ID = 'application';

export interface FakeFeatureFlagsRepository {
  getApplication(): Promise<FakeFeatureFlags>;
  setApplication(featureFlags: FakeFeatureFlags, now?: Date): Promise<void>;
}

export function createFakeFeatureFlagsRepository(
  database: FakeDatabaseConnection
): FakeFeatureFlagsRepository {
  const runtimeFeatureFlagsTable = createSchemaTable(
    database,
    'runtimeFeatureFlags'
  );

  return { getApplication, setApplication };

  async function getApplication(): Promise<FakeFeatureFlags> {
    const record = await runtimeFeatureFlagsTable.get(
      APPLICATION_FEATURE_FLAGS_ID
    );
    return { ...record?.featureFlags };
  }

  async function setApplication(
    featureFlags: FakeFeatureFlags,
    now = new Date()
  ): Promise<void> {
    await runSchemaTableTransaction(
      database,
      ['runtimeFeatureFlags'],
      async (transaction) => {
        const runtimeFeatureFlags = transaction.table('runtimeFeatureFlags');
        const record = {
          featureFlags: { ...featureFlags },
          id: APPLICATION_FEATURE_FLAGS_ID,
          updatedAt: now,
        } as const;

        if (
          (await runtimeFeatureFlags.get(APPLICATION_FEATURE_FLAGS_ID)) ===
          undefined
        ) {
          await runtimeFeatureFlags.insert(
            APPLICATION_FEATURE_FLAGS_ID,
            record
          );
        } else {
          await runtimeFeatureFlags.update(
            APPLICATION_FEATURE_FLAGS_ID,
            record
          );
        }
      }
    );
  }
}
