import type { RuntimeFeatureFlags } from '@war-chest/feature-flags';
import type { FakeDatabaseConnection } from '../schema.js';
import { createSchemaTable, runSchemaTableTransaction } from '../Table.js';

const APPLICATION_FEATURE_FLAGS_ID = 'application';

export interface FakeFeatureFlagsRepository {
  getApplication(): Promise<RuntimeFeatureFlags>;
  setApplication(featureFlags: RuntimeFeatureFlags, now?: Date): Promise<void>;
}

export function createFakeFeatureFlagsRepository(
  database: FakeDatabaseConnection
): FakeFeatureFlagsRepository {
  const runtimeFeatureFlagsTable = createSchemaTable(
    database,
    'runtimeFeatureFlags'
  );

  return { getApplication, setApplication };

  async function getApplication(): Promise<RuntimeFeatureFlags> {
    const record = await runtimeFeatureFlagsTable.get(
      APPLICATION_FEATURE_FLAGS_ID
    );
    if (record === undefined) {
      throw new Error('Fake runtime feature flags are not initialized.');
    }

    return { ...record.featureFlags };
  }

  async function setApplication(
    featureFlags: RuntimeFeatureFlags,
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
