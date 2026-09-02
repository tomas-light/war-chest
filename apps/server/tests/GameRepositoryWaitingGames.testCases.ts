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
import { eq } from 'drizzle-orm';
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
const SECOND_CREATE_COMMAND_ID = '30000000-0000-4000-8000-000000000002';
const GAME_COMMAND_ID = '30000000-0000-4000-8000-000000000003';
const CREATE_REQUEST_HASH = 'a'.repeat(64);
const SECOND_CREATE_REQUEST_HASH = 'b'.repeat(64);
const GAME_REQUEST_HASH = 'c'.repeat(64);
const DEFAULT_CREATE_GAME_COMMAND = {
  creatorId: FIRST_USER_ID,
  featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
  type: 'CreateGame',
} as const;
const DEFAULT_CREATE_GAME_EVENT = createGame(DEFAULT_CREATE_GAME_COMMAND);

const describeWithPostgreSql =
  TEST_DATABASE_URL === undefined ? describe.skip : describe;

describeWithPostgreSql('GameRepository waiting games', () => {
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
  test('deletes an expired empty waiting game with its command and event', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);
    const createdAt = new Date('2026-08-16T12:00:00.000Z');
    await database.update(games).set({ createdAt }).where(eq(games.id, gameId));

    const result = await repository.deleteExpiredWaitingGame({
      expiredBefore: createdAt,
      gameId,
    });

    expect(result).toEqual({ status: 'deleted' });
    expect(await database.select().from(games)).toEqual([]);
    expect(await database.select().from(processedCommands)).toEqual([]);
    expect(await database.select().from(gameEvents)).toEqual([]);
  });

  test('deletes a waiting game with occupied seats when its creator closes it', async () => {
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
          payload: { playerId: SECOND_USER_ID, seat: 1, team: 'black' },
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
          team: 'black',
          userId: SECOND_USER_ID,
        },
      ],
      requestHash: GAME_REQUEST_HASH,
      userId: SECOND_USER_ID,
    });

    const result = await repository.deleteWaitingGame({
      expectedVersion: 2,
      gameId,
    });

    expect(result).toEqual({ status: 'deleted' });
    expect(await repository.findGame(gameId)).toBeNull();
    expect(await repository.findParticipant(gameId, SECOND_USER_ID)).toBeNull();
    expect(await repository.loadEvents(gameId)).toEqual([]);
    expect(await repository.findProcessedCommand(GAME_COMMAND_ID)).toBeNull();
  });

  test('keeps an empty waiting game before its timeout', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);
    const createdAt = new Date('2026-08-16T12:00:00.000Z');
    await database.update(games).set({ createdAt }).where(eq(games.id, gameId));

    const result = await repository.deleteExpiredWaitingGame({
      expiredBefore: new Date(createdAt.getTime() - 1),
      gameId,
    });

    expect(result).toEqual({ createdAt, status: 'notExpired' });
    expect(await database.select().from(games)).toHaveLength(1);
  });

  test('keeps an expired waiting game when a player occupies a seat', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);
    const createdAt = new Date('2026-08-16T12:00:00.000Z');
    await database.update(games).set({ createdAt }).where(eq(games.id, gameId));
    await database.insert(gameParticipants).values({
      gameId,
      seat: 1,
      team: 'white',
      userId: FIRST_USER_ID,
    });

    const result = await repository.deleteExpiredWaitingGame({
      expiredBefore: createdAt,
      gameId,
    });

    expect(result).toEqual({ status: 'notEmpty' });
    expect(await database.select().from(games)).toHaveLength(1);
  });

  test('lists only waiting games without persisted players for recovery', async () => {
    const emptyCreated = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });
    const occupiedCreated = await repository.createGame({
      commandId: SECOND_CREATE_COMMAND_ID,
      creatorUserId: SECOND_USER_ID,
      event: DEFAULT_CREATE_GAME_EVENT,
      requestHash: SECOND_CREATE_REQUEST_HASH,
    });
    const emptyGameId = requireCreatedGameId(emptyCreated);
    const occupiedGameId = requireCreatedGameId(occupiedCreated);
    await database.insert(gameParticipants).values({
      gameId: occupiedGameId,
      seat: 1,
      team: 'black',
      userId: SECOND_USER_ID,
    });

    const emptyWaitingGames = await repository.listEmptyWaitingGames();

    expect(emptyWaitingGames).toEqual([
      expect.objectContaining({ id: emptyGameId }),
    ]);
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
