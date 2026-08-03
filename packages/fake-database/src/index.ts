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
} from './fake-database.js';
export { FAKE_DATABASE_VERSION, migrateFakeDatabase } from './migrations.js';
export {
  type FakeFeatureFlagsRepository,
  createFakeFeatureFlagsRepository,
} from './repositories/feature-flags.js';
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
export { resetFakeDatabase } from './reset.js';
export {
  DEFAULT_FAKE_FEATURE_FLAGS,
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
  FakeFeatureFlags,
  FakeGame,
  FakeGameEvent,
  FakeGameParticipant,
  FakeGameStatus,
  FakeParticipantRole,
  FakeProcessedCommand,
  FakeRuntimeFeatureFlags,
  FakeUser,
  FakeUserIdentity,
  JsonPrimitive,
  JsonValue,
} from './schema.js';
export {
  type SchemaTable,
  type SchemaTableTransaction,
  type Table,
  type TableIndex,
  createSchemaTable,
  createTransactionSchemaTable,
  runSchemaTableTransaction,
} from './table.js';
