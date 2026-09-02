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
const SECOND_GAME_COMMAND_ID = '30000000-0000-4000-8000-000000000004';
const CREATE_REQUEST_HASH = 'a'.repeat(64);
const GAME_REQUEST_HASH = 'c'.repeat(64);
const SECOND_GAME_REQUEST_HASH = 'd'.repeat(64);
const DEFAULT_CREATE_GAME_COMMAND = {
  creatorId: FIRST_USER_ID,
  featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
  type: 'CreateGame',
} as const;
const DEFAULT_CREATE_GAME_EVENT = createGame(DEFAULT_CREATE_GAME_COMMAND);

const describeWithPostgreSql =
  TEST_DATABASE_URL === undefined ? describe.skip : describe;

describeWithPostgreSql('GameRepository participants', () => {
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
  test('returns stored participants only for matching game and user', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);
    await repository.saveCommand({
      commandId: GAME_COMMAND_ID,
      commandType: 'JoinGame',
      events: [
        {
          payload: { playerId: FIRST_USER_ID, seat: 1, team: 'white' },
          sequence: 2,
          type: 'PlayerJoined',
          version: GAME_EVENT_VERSION,
        },
      ],
      expectedVersion: 1,
      gameId,
      participantChanges: [
        {
          operation: 'addPlayer',
          seat: 1,
          team: 'white',
          userId: FIRST_USER_ID,
        },
      ],
      requestHash: GAME_REQUEST_HASH,
      userId: FIRST_USER_ID,
    });

    expect(await repository.findParticipant(gameId, FIRST_USER_ID)).toEqual({
      gameId,
      seat: 1,
      team: 'white',
      userId: FIRST_USER_ID,
    });
    expect(await repository.findParticipant(gameId, SECOND_USER_ID)).toBeNull();
  });

  test('moves an existing participant to the remaining free position', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);
    await repository.saveCommand({
      commandId: GAME_COMMAND_ID,
      commandType: 'JoinGame',
      events: [
        {
          payload: { playerId: FIRST_USER_ID, seat: 1, team: 'white' },
          sequence: 2,
          type: 'PlayerJoined',
          version: GAME_EVENT_VERSION,
        },
      ],
      expectedVersion: 1,
      gameId,
      participantChanges: [
        {
          operation: 'addPlayer',
          seat: 1,
          team: 'white',
          userId: FIRST_USER_ID,
        },
      ],
      requestHash: GAME_REQUEST_HASH,
      userId: FIRST_USER_ID,
    });

    const result = await repository.saveCommand({
      commandId: SECOND_GAME_COMMAND_ID,
      commandType: 'JoinGame',
      events: [
        {
          payload: { playerId: FIRST_USER_ID, seat: 1, team: 'black' },
          sequence: 3,
          type: 'PlayerPositionChanged',
          version: GAME_EVENT_VERSION,
        },
      ],
      expectedVersion: 2,
      gameId,
      participantChanges: [
        {
          operation: 'movePlayer',
          seat: 1,
          team: 'black',
          userId: FIRST_USER_ID,
        },
      ],
      requestHash: SECOND_GAME_REQUEST_HASH,
      userId: FIRST_USER_ID,
    });

    expect(result).toEqual({ currentVersion: 3, status: 'saved' });
    expect(await repository.findParticipant(gameId, FIRST_USER_ID)).toEqual({
      gameId,
      seat: 1,
      team: 'black',
      userId: FIRST_USER_ID,
    });
    expect(await repository.loadEvents(gameId)).toHaveLength(3);
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
