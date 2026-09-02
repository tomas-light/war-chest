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
import { createGame, GAME_EVENT_VERSION } from '@war-chest/game-engine';
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
const GAME_COMMAND_ID = '30000000-0000-4000-8000-000000000003';
const CREATE_REQUEST_HASH = 'a'.repeat(64);
const GAME_REQUEST_HASH = 'c'.repeat(64);
const DEFAULT_CREATE_GAME_COMMAND = {
  creatorId: FIRST_USER_ID,
  featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
  type: 'CreateGame',
} as const;
const DEFAULT_CREATE_GAME_EVENT = createGame(DEFAULT_CREATE_GAME_COMMAND);

const describeWithPostgreSql =
  TEST_DATABASE_URL === undefined ? describe.skip : describe;

describeWithPostgreSql('GameRepository loadEvents', () => {
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
  test('loads only events strictly after the requested sequence', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);
    await repository.saveCommand({
      commandId: GAME_COMMAND_ID,
      commandType: 'MultipleEventsForTest',
      events: [
        {
          payload: { playerId: SECOND_USER_ID, seat: 1, team: 'black' },
          sequence: 2,
          type: 'PlayerJoined',
          version: GAME_EVENT_VERSION,
        },
        {
          payload: { firstPlayerId: FIRST_USER_ID },
          sequence: 3,
          type: 'GameStarted',
          version: GAME_EVENT_VERSION,
        },
      ],
      expectedVersion: 1,
      gameId,
      requestHash: GAME_REQUEST_HASH,
      userId: FIRST_USER_ID,
    });

    const events = await repository.loadEvents(gameId, 1);

    expect(events.map((event) => event.sequence)).toEqual([2, 3]);
  });

  test('rejects a non-contiguous event sequence without persistence', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);

    await expect(
      repository.saveCommand({
        commandId: GAME_COMMAND_ID,
        commandType: 'StartGame',
        events: [
          {
            payload: { firstPlayerId: FIRST_USER_ID },
            sequence: 3,
            type: 'GameStarted',
            version: GAME_EVENT_VERSION,
          },
        ],
        expectedVersion: 1,
        gameId,
        requestHash: GAME_REQUEST_HASH,
        userId: FIRST_USER_ID,
      })
    ).rejects.toThrow('Event sequence 3 does not follow 1.');
    expect(await repository.findProcessedCommand(GAME_COMMAND_ID)).toBeNull();
    expect(await repository.loadEvents(gameId)).toHaveLength(1);
  });

  test('reports corrupted persisted events without exposing their payload', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);
    await database.insert(gameEvents).values({
      commandId: null,
      gameId,
      payload: { privateData: 'must-not-appear' },
      sequence: 2,
      type: 'UnknownEvent',
      version: GAME_EVENT_VERSION,
    });

    const loadEvents = repository.loadEvents(gameId);

    await expect(loadEvents).rejects.toMatchObject({
      message: `Stored event 2 for game ${gameId} is corrupted.`,
      name: 'CorruptedGameHistoryError',
    });
    await expect(loadEvents).rejects.not.toThrow('must-not-appear');
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

function requireCreatedGameId(result: {
  gameId?: string;
  status: string;
}): string {
  if (result.status !== 'created' || result.gameId === undefined) {
    throw new Error('Expected a newly created game.');
  }

  return result.gameId;
}
