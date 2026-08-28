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
import {
  type GameEventData,
  createGame,
  GAME_EVENT_VERSION,
} from '@war-chest/game-engine';
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
const MISSING_USER_ID = '10000000-0000-4000-8000-000000000099';
const CREATE_COMMAND_ID = '30000000-0000-4000-8000-000000000001';
const SECOND_CREATE_COMMAND_ID = '30000000-0000-4000-8000-000000000002';
const GAME_COMMAND_ID = '30000000-0000-4000-8000-000000000003';
const SECOND_GAME_COMMAND_ID = '30000000-0000-4000-8000-000000000004';
const POSTGRESQL_FOREIGN_KEY_VIOLATION_SQLSTATE = '23503';
const CREATE_REQUEST_HASH = 'a'.repeat(64);
const SECOND_CREATE_REQUEST_HASH = 'b'.repeat(64);
const GAME_REQUEST_HASH = 'c'.repeat(64);
const SECOND_GAME_REQUEST_HASH = 'd'.repeat(64);
const DEFAULT_CREATE_GAME_COMMAND = {
  featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
  type: 'CreateGame',
} as const;

const describeWithPostgreSql =
  TEST_DATABASE_URL === undefined ? describe.skip : describe;

describeWithPostgreSql('GameRepository PostgreSQL integration', () => {
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
      { displayName: 'Ada', id: FIRST_USER_ID },
      { displayName: 'Grace', id: SECOND_USER_ID },
      { displayName: 'Linus', id: THIRD_USER_ID },
    ]);
    repository = createGameRepository(database);
  });

  afterAll(async () => {
    await driver.end();
  });

  test('creates the game, command, and first event atomically', async () => {
    const event = createGame(DEFAULT_CREATE_GAME_COMMAND);

    const result = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event,
      requestHash: CREATE_REQUEST_HASH,
    });
    const storedGames = await database.select().from(games);
    const storedCommands = await database.select().from(processedCommands);
    const storedEvents = await database.select().from(gameEvents);

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
  });

  test('returns the stored game for an exact duplicate create command', async () => {
    const event = createGame(DEFAULT_CREATE_GAME_COMMAND);
    const firstResult = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event,
      requestHash: CREATE_REQUEST_HASH,
    });

    const duplicateResult = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event,
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
    const event = createGame(DEFAULT_CREATE_GAME_COMMAND);
    await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event,
      requestHash: CREATE_REQUEST_HASH,
    });

    const result = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: SECOND_USER_ID,
      event,
      requestHash: CREATE_REQUEST_HASH,
    });

    expect(result).toEqual({ status: 'commandIdConflict' });
    expect(await database.select().from(games)).toHaveLength(1);
  });

  test('classifies concurrent create requests as created and duplicate', async () => {
    const event = createGame(DEFAULT_CREATE_GAME_COMMAND);

    const results = await Promise.all([
      repository.createGame({
        commandId: CREATE_COMMAND_ID,
        creatorUserId: FIRST_USER_ID,
        event,
        requestHash: CREATE_REQUEST_HASH,
      }),
      repository.createGame({
        commandId: CREATE_COMMAND_ID,
        creatorUserId: FIRST_USER_ID,
        event,
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

  test('saves events and SQL projections in the command transaction', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);
    const startedAt = new Date('2026-08-16T12:00:00.000Z');
    const events: readonly GameEventData[] = [
      {
        payload: { playerId: FIRST_USER_ID, seat: 1, team: 'white' },
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
    ];

    const result = await repository.saveCommand({
      commandId: GAME_COMMAND_ID,
      commandType: 'JoinAndStartForTest',
      events,
      expectedVersion: 1,
      gameChanges: { startedAt, status: 'active' },
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
    const storedGame = await repository.findGame(gameId);
    const storedParticipant = await repository.findParticipant(
      gameId,
      FIRST_USER_ID
    );
    const storedEvents = await repository.loadEvents(gameId);

    expect(result).toEqual({ currentVersion: 3, status: 'saved' });
    expect(storedGame).toMatchObject({
      currentVersion: 3,
      startedAt,
      status: 'active',
    });
    expect(storedParticipant).toEqual({
      gameId,
      role: 'player',
      seat: 1,
      team: 'white',
      userId: FIRST_USER_ID,
    });
    expect(storedEvents).toEqual([
      createGame(DEFAULT_CREATE_GAME_COMMAND),
      ...events,
    ]);
  });

  test('returns duplicate before checking an outdated expected version', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);
    const event: GameEventData = {
      payload: { firstPlayerId: FIRST_USER_ID },
      sequence: 2,
      type: 'GameStarted',
      version: GAME_EVENT_VERSION,
    };
    const input = {
      commandId: GAME_COMMAND_ID,
      commandType: 'StartGame',
      events: [event],
      expectedVersion: 1,
      gameId,
      requestHash: GAME_REQUEST_HASH,
      userId: FIRST_USER_ID,
    } as const;
    await repository.saveCommand(input);

    const duplicateResult = await repository.saveCommand(input);

    expect(duplicateResult).toEqual({
      currentVersion: 2,
      status: 'duplicateCommand',
    });
  });

  test('rejects a command id already used by another game', async () => {
    const firstCreated = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
      requestHash: CREATE_REQUEST_HASH,
    });
    const secondCreated = await repository.createGame({
      commandId: SECOND_CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
      requestHash: SECOND_CREATE_REQUEST_HASH,
    });
    const firstGameId = requireCreatedGameId(firstCreated);
    const secondGameId = requireCreatedGameId(secondCreated);
    const event: GameEventData = {
      payload: { firstPlayerId: FIRST_USER_ID },
      sequence: 2,
      type: 'GameStarted',
      version: GAME_EVENT_VERSION,
    };
    await repository.saveCommand({
      commandId: GAME_COMMAND_ID,
      commandType: 'StartGame',
      events: [event],
      expectedVersion: 1,
      gameId: firstGameId,
      requestHash: GAME_REQUEST_HASH,
      userId: FIRST_USER_ID,
    });

    const result = await repository.saveCommand({
      commandId: GAME_COMMAND_ID,
      commandType: 'StartGame',
      events: [event],
      expectedVersion: 1,
      gameId: secondGameId,
      requestHash: GAME_REQUEST_HASH,
      userId: FIRST_USER_ID,
    });

    expect(result).toEqual({ status: 'commandIdConflict' });
    expect(await repository.findGame(secondGameId)).toMatchObject({
      currentVersion: 1,
    });
  });

  test('classifies a concurrent command id reused across games', async () => {
    const firstCreated = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
      requestHash: CREATE_REQUEST_HASH,
    });
    const secondCreated = await repository.createGame({
      commandId: SECOND_CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
      requestHash: SECOND_CREATE_REQUEST_HASH,
    });
    const firstGameId = requireCreatedGameId(firstCreated);
    const secondGameId = requireCreatedGameId(secondCreated);

    const results = await Promise.all([
      repository.saveCommand({
        commandId: GAME_COMMAND_ID,
        commandType: 'StartGame',
        events: [
          {
            payload: { firstPlayerId: FIRST_USER_ID },
            sequence: 2,
            type: 'GameStarted',
            version: GAME_EVENT_VERSION,
          },
        ],
        expectedVersion: 1,
        gameId: firstGameId,
        requestHash: GAME_REQUEST_HASH,
        userId: FIRST_USER_ID,
      }),
      repository.saveCommand({
        commandId: GAME_COMMAND_ID,
        commandType: 'StartGame',
        events: [
          {
            payload: { firstPlayerId: FIRST_USER_ID },
            sequence: 2,
            type: 'GameStarted',
            version: GAME_EVENT_VERSION,
          },
        ],
        expectedVersion: 1,
        gameId: secondGameId,
        requestHash: GAME_REQUEST_HASH,
        userId: FIRST_USER_ID,
      }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'commandIdConflict',
      'saved',
    ]);
  });

  test('does not persist a command with an outdated expected version', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);

    const result = await repository.saveCommand({
      commandId: GAME_COMMAND_ID,
      commandType: 'StartGame',
      events: [
        {
          payload: { firstPlayerId: FIRST_USER_ID },
          sequence: 2,
          type: 'GameStarted',
          version: GAME_EVENT_VERSION,
        },
      ],
      expectedVersion: 0,
      gameId,
      requestHash: GAME_REQUEST_HASH,
      userId: FIRST_USER_ID,
    });

    expect(result).toEqual({ currentVersion: 1, status: 'versionConflict' });
    expect(await repository.findProcessedCommand(GAME_COMMAND_ID)).toBeNull();
    expect(await repository.loadEvents(gameId)).toHaveLength(1);
  });

  test('rolls back the command when a projection insert fails', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);

    await expect(
      repository.saveCommand({
        commandId: GAME_COMMAND_ID,
        commandType: 'JoinGame',
        events: [
          {
            payload: { playerId: MISSING_USER_ID, seat: 1, team: 'white' },
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
            userId: MISSING_USER_ID,
          },
        ],
        requestHash: GAME_REQUEST_HASH,
        userId: FIRST_USER_ID,
      })
    ).rejects.toMatchObject({
      cause: { code: POSTGRESQL_FOREIGN_KEY_VIOLATION_SQLSTATE },
    });
    expect(await repository.findProcessedCommand(GAME_COMMAND_ID)).toBeNull();
    expect(await repository.loadEvents(gameId)).toHaveLength(1);
    expect(await repository.findGame(gameId)).toMatchObject({
      currentVersion: 1,
    });
  });

  test('allows only one concurrent command for the same expected version', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);

    const results = await Promise.all([
      repository.saveCommand({
        commandId: GAME_COMMAND_ID,
        commandType: 'StartGame',
        events: [
          {
            payload: { firstPlayerId: FIRST_USER_ID },
            sequence: 2,
            type: 'GameStarted',
            version: GAME_EVENT_VERSION,
          },
        ],
        expectedVersion: 1,
        gameId,
        requestHash: GAME_REQUEST_HASH,
        userId: FIRST_USER_ID,
      }),
      repository.saveCommand({
        commandId: SECOND_GAME_COMMAND_ID,
        commandType: 'StartGame',
        events: [
          {
            payload: { firstPlayerId: SECOND_USER_ID },
            sequence: 2,
            type: 'GameStarted',
            version: GAME_EVENT_VERSION,
          },
        ],
        expectedVersion: 1,
        gameId,
        requestHash: SECOND_GAME_REQUEST_HASH,
        userId: SECOND_USER_ID,
      }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'saved',
      'versionConflict',
    ]);
    expect(await repository.findGame(gameId)).toMatchObject({
      currentVersion: 2,
    });
    expect(await repository.loadEvents(gameId)).toHaveLength(2);
  });

  test('loads only events strictly after the requested sequence', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);
    await repository.saveCommand({
      commandId: GAME_COMMAND_ID,
      commandType: 'MultipleEventsForTest',
      events: [
        {
          payload: { playerId: FIRST_USER_ID, seat: 1, team: 'white' },
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
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
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
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
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

  test('returns stored participants only for matching game and user', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);
    await database.insert(gameParticipants).values({
      gameId,
      role: 'player',
      seat: 1,
      team: 'white',
      userId: FIRST_USER_ID,
    });

    expect(await repository.findParticipant(gameId, FIRST_USER_ID)).toEqual({
      gameId,
      role: 'player',
      seat: 1,
      team: 'white',
      userId: FIRST_USER_ID,
    });
    expect(await repository.findParticipant(gameId, SECOND_USER_ID)).toBeNull();
  });

  test('stores system events without a processed command', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);

    const result = await repository.saveSystemEvents({
      events: [
        {
          payload: {
            playerId: FIRST_USER_ID,
            reconnectDeadline: '2026-08-16T12:15:00.000Z',
          },
          sequence: 2,
          type: 'PlayerDisconnected',
          version: GAME_EVENT_VERSION,
        },
      ],
      expectedVersion: 1,
      gameId,
    });
    const storedEvents = await database.select().from(gameEvents);

    expect(result).toEqual({ currentVersion: 2, status: 'saved' });
    expect(storedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandId: null,
          sequence: 2,
          type: 'PlayerDisconnected',
        }),
      ])
    );
    expect(await database.select().from(processedCommands)).toHaveLength(1);
  });

  test('allows only one concurrent system worker for a version', async () => {
    const created = await repository.createGame({
      commandId: CREATE_COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: createGame(DEFAULT_CREATE_GAME_COMMAND),
      requestHash: CREATE_REQUEST_HASH,
    });
    const gameId = requireCreatedGameId(created);
    const input = {
      events: [
        {
          payload: {
            playerId: FIRST_USER_ID,
            reconnectDeadline: '2026-08-16T12:15:00.000Z',
          },
          sequence: 2,
          type: 'PlayerDisconnected',
          version: GAME_EVENT_VERSION,
        },
      ],
      expectedVersion: 1,
      gameId,
    } as const;

    const results = await Promise.all([
      repository.saveSystemEvents(input),
      repository.saveSystemEvents(input),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'saved',
      'versionConflict',
    ]);
    expect(await repository.loadEvents(gameId)).toHaveLength(2);
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

function readResultGameId(result: { gameId?: string }): string[] {
  return result.gameId === undefined ? [] : [result.gameId];
}
