import { type OpenFakeDatabaseOptions, openFakeDatabase } from './database.js';
import {
  type FakeFeatureFlagsRepository,
  createFakeFeatureFlagsRepository,
} from './repositories/feature-flags.js';
import {
  type FakeGameRepository,
  createFakeGameRepository,
} from './repositories/games.js';
import {
  type FakeSessionRepository,
  createFakeSessionRepository,
} from './repositories/sessions.js';
import {
  type FakeUserRepository,
  createFakeUserRepository,
} from './repositories/users.js';
import { resetFakeDatabase } from './reset.js';
import {
  type FakeDatabaseConnection,
  type FakeDatabaseSchema,
  FAKE_DATABASE_STORE_NAMES,
} from './schema.js';
import { seedFakeDatabase } from './seed.js';
import {
  type SchemaTable,
  type SchemaTableTransaction,
  createSchemaTable,
  runSchemaTableTransaction,
} from './table.js';

export interface FakeDatabaseTables {
  authSession: SchemaTable<FakeDatabaseSchema, 'authSessions'>;
  game: SchemaTable<FakeDatabaseSchema, 'games'>;
  gameEvent: SchemaTable<FakeDatabaseSchema, 'gameEvents'>;
  gameParticipant: SchemaTable<FakeDatabaseSchema, 'gameParticipants'>;
  processedCommand: SchemaTable<FakeDatabaseSchema, 'processedCommands'>;
  runtimeFeatureFlags: SchemaTable<FakeDatabaseSchema, 'runtimeFeatureFlags'>;
  user: SchemaTable<FakeDatabaseSchema, 'users'>;
  userIdentity: SchemaTable<FakeDatabaseSchema, 'userIdentities'>;
}

export interface FakeDatabase extends FakeDatabaseTables {
  connection: FakeDatabaseConnection;
  featureFlags: FakeFeatureFlagsRepository;
  games: FakeGameRepository;
  sessions: FakeSessionRepository;
  users: FakeUserRepository;
  close(): void;
  reset(): Promise<void>;
  transaction<Result>(
    operation: (tables: FakeDatabaseTables) => Promise<Result>
  ): Promise<Result>;
}

export async function createFakeDatabase(
  options: OpenFakeDatabaseOptions = {}
): Promise<FakeDatabase> {
  const connection = await openFakeDatabase(options);

  try {
    await seedFakeDatabase(connection);
  } catch (error) {
    connection.close();
    throw error;
  }

  const tables = createFakeDatabaseTables(connection);

  return {
    ...tables,
    close,
    connection,
    featureFlags: createFakeFeatureFlagsRepository(connection),
    games: createFakeGameRepository(connection),
    reset,
    sessions: createFakeSessionRepository(connection),
    users: createFakeUserRepository(connection),
    transaction,
  };

  function close(): void {
    connection.close();
  }

  function reset(): Promise<void> {
    return resetFakeDatabase(connection);
  }

  function transaction<Result>(
    operation: (tables: FakeDatabaseTables) => Promise<Result>
  ): Promise<Result> {
    return runSchemaTableTransaction(
      connection,
      FAKE_DATABASE_STORE_NAMES,
      async (tableTransaction) =>
        operation(createFakeTransactionTables(tableTransaction))
    );
  }
}

function createFakeDatabaseTables(
  database: FakeDatabaseConnection
): FakeDatabaseTables {
  return {
    authSession: createSchemaTable(database, 'authSessions'),
    game: createSchemaTable(database, 'games'),
    gameEvent: createSchemaTable(database, 'gameEvents'),
    gameParticipant: createSchemaTable(database, 'gameParticipants'),
    processedCommand: createSchemaTable(database, 'processedCommands'),
    runtimeFeatureFlags: createSchemaTable(database, 'runtimeFeatureFlags'),
    user: createSchemaTable(database, 'users'),
    userIdentity: createSchemaTable(database, 'userIdentities'),
  };
}

function createFakeTransactionTables(
  transaction: SchemaTableTransaction<
    FakeDatabaseSchema,
    typeof FAKE_DATABASE_STORE_NAMES
  >
): FakeDatabaseTables {
  return {
    authSession: transaction.table('authSessions'),
    game: transaction.table('games'),
    gameEvent: transaction.table('gameEvents'),
    gameParticipant: transaction.table('gameParticipants'),
    processedCommand: transaction.table('processedCommands'),
    runtimeFeatureFlags: transaction.table('runtimeFeatureFlags'),
    user: transaction.table('users'),
    userIdentity: transaction.table('userIdentities'),
  };
}
