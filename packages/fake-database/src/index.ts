export {
  type OpenFakeDatabaseOptions,
  DEFAULT_FAKE_DATABASE_NAME,
  deleteFakeDatabase,
  openFakeDatabase,
} from './database.js';
export {
  type FakeDatabase,
  type FakeDatabaseTables,
  createFakeDatabase,
} from './FakeDatabase.js';
export { FAKE_DATABASE_VERSION, migrateFakeDatabase } from './migrations.js';
export {
  type FakeFeatureFlagsRepository,
  createFakeFeatureFlagsRepository,
} from './repositories/featureFlags.js';
export {
  type FakeGameChanges,
  type FakeGameRepository,
  createFakeGameRepository,
} from './repositories/games.js';
export {
  type FakeSessionRepository,
  createFakeSessionRepository,
} from './repositories/sessions.js';
export {
  type FakeUserRepository,
  type FakeUserWithIdentity,
  createFakeUserRepository,
} from './repositories/users.js';
export { resetFakeDatabase } from './resetFakeDatabase.js';
export {
  FAKE_PROVIDER_SUBJECTS,
  FAKE_SEED_IDENTIFIERS,
  FAKE_USER_IDENTITIES,
  FAKE_USERS,
  seedFakeDatabase,
} from './seed.js';
export type {
  FakeAuthProvider,
  FakeAuthSession,
  FakeDatabaseConnection,
  FakeDatabaseSchema,
  FakeGame,
  FakeGameEvent,
  FakeGameParticipant,
  FakeGameStatus,
  FakeProcessedCommand,
  FakeRuntimeFeatureFlags,
  FakeUser,
  FakeUserIdentity,
} from './schema.js';
export {
  type SchemaTable,
  type SchemaTableTransaction,
  type Table,
  type TableIndex,
  createSchemaTable,
  createTransactionSchemaTable,
  runSchemaTableTransaction,
} from './Table.js';
