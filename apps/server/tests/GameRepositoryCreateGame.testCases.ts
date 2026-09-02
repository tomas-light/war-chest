import { fileURLToPath } from 'node:url';
import {
  type Database,
  gameEvents,
  gameParticipants,
  games,
  processedCommands,
  users,
} from '@war-chest/database';
import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { createGame } from '@war-chest/game-engine';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres, { type Sql } from 'postgres';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest';
import * as schema from '../../../packages/database/src/schema/index.js';
import {
  type GameRepository,
  createGameRepository,
} from '../src/games/GameRepository.js';

const TEST_DATABASE_URL = process.env.WAR_CHEST_TEST_DATABASE_URL;
const MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../../../packages/database/migrations', import.meta.url)
);
const FIRST_USER_ID = '10000000-0000-4000-8000-000000000001';
const SECOND_USER_ID = '10000000-0000-4000-8000-000000000002';
const THIRD_USER_ID = '10000000-0000-4000-8000-000000000003';
const CREATE_COMMAND_ID = '30000000-0000-4000-8000-000000000001';
const CREATE_REQUEST_HASH = 'a'.repeat(64);
const DEFAULT_CREATE_GAME_COMMAND = {
  creatorId: FIRST_USER_ID,
  featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
  type: 'CreateGame',
} as const;
const DEFAULT_CREATE_GAME_EVENT = createGame(DEFAULT_CREATE_GAME_COMMAND);

const describeWithPostgreSql =
  TEST_DATABASE_URL === undefined ? describe.skip : describe;

describeWithPostgreSql('GameRepository createGame', () => {
  let database: Database;
  let driver: Sql;
  let repository: GameRepository;

  beforeAll(async () => {
    const databaseUrl = requireTestDatabaseUrl(TEST_DATABASE_URL);

    driver = postgres(databaseUrl, { max: 10 });
    database = drizzle(driver, { schema });
    await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
  });

  beforeEach(async () => {
    await database.delete(gameEvents);
    await database.delete(processedCommands);
    await database.delete(gameParticipants);
    await database.delete(games);
    await database.delete(users);
    await database.insert(users).values([
      {
        displayName: 'Ada',
        email: 'ada@example.com',
        id: FIRST_USER_ID,
      },
      {
        displayName: 'Grace',
        email: 'grace@example.com',
        id: SECOND_USER_ID,
      },
      {
        displayName: 'Linus',
        email: 'linus@example.com',
        id: THIRD_USER_ID,
      },
    ]);
    repository = createGameRepository(database);
  });

  afterAll(async () => {
    await driver.end();
  });
  test('creates an empty game, command, and first event atomically', async () => {
    const result = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });
    const storedGames = await database.select().from(games);
    const storedCommands = await database.select().from(processedCommands);
    const storedEvents = await database.select().from(gameEvents);
    const storedParticipants = await database.select().from(gameParticipants);

    expect(result.status).toBe('created');
    expect(storedGames).toHaveLength(1);
    expect(storedGames[0]).toMatchObject({
      currentVersion: 1,
      status: 'waiting',
    });
    expect(storedCommands).toEqual([
      expect.objectContaining({
        commandType: 'CreateGame',
        gameId: storedGames[0]?.id,
        id: CREATE_COMMAND_ID,
        requestHash: CREATE_REQUEST_HASH,
        userId: FIRST_USER_ID,
      }),
    ]);
    expect(storedEvents).toEqual([
      expect.objectContaining({
        commandId: CREATE_COMMAND_ID,
        gameId: storedGames[0]?.id,
        sequence: 1,
        type: 'GameCreated',
      }),
    ]);
    expect(storedParticipants).toEqual([]);
  });
  test('returns the stored game for an exact duplicate create command', async () => {
    const firstResult = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });

    const duplicateResult = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });

    expect(firstResult.status).toBe('created');
    expect(duplicateResult).toEqual({
      gameId: 'gameId' in firstResult ? firstResult.gameId : undefined,
      status: 'duplicateCommand',
    });
    expect(await database.select().from(games)).toHaveLength(1);
    expect(await database.select().from(processedCommands)).toHaveLength(1);
    expect(await database.select().from(gameEvents)).toHaveLength(1);
  });

  test('rejects a create command id reused by another user', async () => {
    await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });

    const result = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: SECOND_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });

    expect(result).toEqual({ status: 'commandIdConflict' });
    expect(await database.select().from(games)).toHaveLength(1);
  });

  test('classifies concurrent create requests as created and duplicate', async () => {
    const results = await Promise.all([
      repository.createGame({
        commandId: CREATE_COMMAND_ID,
        creatorUserId: FIRST_USER_ID,
        event: DEFAULT_CREATE_GAME_EVENT,
        requestHash: CREATE_REQUEST_HASH,
      }),
      repository.createGame({
        commandId: CREATE_COMMAND_ID,
        creatorUserId: FIRST_USER_ID,
        event: DEFAULT_CREATE_GAME_EVENT,
        requestHash: CREATE_REQUEST_HASH,
      }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'created',
      'duplicateCommand',
    ]);
    expect(new Set(results.flatMap(readResultGameId)).size).toBe(1);
    expect(await database.select().from(games)).toHaveLength(1);
  });
});

function requireTestDatabaseUrl(value: string | undefined): string {
  if (value === undefined) {
    throw new Error('WAR_CHEST_TEST_DATABASE_URL is required.');
  }

  const databaseName = new URL(value).pathname.slice(1);

  if (!databaseName.endsWith('_test')) {
    throw new Error('The integration database name must end with "_test".');
  }

  return value;
}

function readResultGameId(
  result: { gameId: string } | { status: string }
): string[] {
  return 'gameId' in result ? [result.gameId] : [];
}
