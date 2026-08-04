import { randomUUID } from 'node:crypto';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  type FakeDatabase,
  type FakeGame,
  type FakeGameEvent,
  createFakeDatabase,
  DEFAULT_FAKE_FEATURE_FLAGS,
  deleteFakeDatabase,
  FAKE_PROVIDER_SUBJECTS,
  FAKE_SEED_IDENTIFIERS,
} from '../src/index.js';

describe('fake database', () => {
  let database: FakeDatabase;
  let databaseName: string;

  beforeEach(async () => {
    databaseName = `war-chest-test-${randomUUID()}`;
    database = await createFakeDatabase({ name: databaseName });
  });

  afterEach(async () => {
    database.close();
    await deleteFakeDatabase({ name: databaseName });
  });

  test('creates every documented object store', () => {
    expect(Array.from(database.connection.objectStoreNames)).toEqual([
      'authSessions',
      'gameEvents',
      'gameParticipants',
      'games',
      'processedCommands',
      'runtimeFeatureFlags',
      'userIdentities',
      'users',
    ]);
  });

  test('creates only the game event sequence index', async () => {
    const transaction = database.connection.transaction(
      [
        'authSessions',
        'gameEvents',
        'gameParticipants',
        'games',
        'processedCommands',
        'runtimeFeatureFlags',
        'userIdentities',
        'users',
      ],
      'readonly'
    );

    expect(
      Array.from(transaction.objectStore('gameEvents').indexNames)
    ).toEqual(['by-game-sequence']);
    expect(
      [
        transaction.objectStore('authSessions'),
        transaction.objectStore('gameParticipants'),
        transaction.objectStore('games'),
        transaction.objectStore('processedCommands'),
        transaction.objectStore('userIdentities'),
        transaction.objectStore('users'),
      ].every((store) => store.indexNames.length === 0)
    ).toBe(true);
    await transaction.done;
  });

  test('inserts a game through the table API', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 0,
      finishedAt: null,
      id: 'inserted-table-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };

    await database.game.insert(game.id, game);

    await expect(database.game.get(game.id)).resolves.toEqual(game);
  });

  test('gets all games through the table API', async () => {
    const firstGame: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 0,
      finishedAt: null,
      id: 'first-table-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };
    const secondGame: FakeGame = {
      createdAt: new Date('2026-08-03T10:01:00.000Z'),
      currentVersion: 0,
      finishedAt: null,
      id: 'second-table-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };
    await database.game.insert(firstGame.id, firstGame);
    await database.game.insert(secondGame.id, secondGame);

    const games = await database.game.getAll();

    expect(games).toEqual([firstGame, secondGame]);
  });

  test('updates an existing game through the table API', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 0,
      finishedAt: null,
      id: 'updated-table-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };
    await database.game.insert(game.id, game);

    await database.game.update(game.id, { ...game, currentVersion: 1 });

    await expect(database.game.get(game.id)).resolves.toMatchObject({
      currentVersion: 1,
    });
  });

  test('does not insert a missing game during update', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 1,
      finishedAt: null,
      id: 'missing-table-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };

    await expect(database.game.update(game.id, game)).resolves.toBeUndefined();
    await expect(database.game.get(game.id)).resolves.toBeUndefined();
  });

  test('deletes a game through the table API', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 0,
      finishedAt: null,
      id: 'deleted-table-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };
    await database.game.insert(game.id, game);

    await database.game.delete(game.id);

    await expect(database.game.get(game.id)).resolves.toBeUndefined();
  });

  test('deletes all games through the table API', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 0,
      finishedAt: null,
      id: 'cleared-table-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };
    await database.game.insert(game.id, game);

    await database.game.deleteAll();

    await expect(database.game.getAll()).resolves.toEqual([]);
  });

  test('rolls back a public table transaction after an error', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 0,
      finishedAt: null,
      id: 'rolled-back-table-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };

    await expect(
      database.transaction(async (tables) => {
        await tables.game.insert(game.id, game);
        throw new Error('Stop the fake transaction.');
      })
    ).rejects.toThrow('Stop the fake transaction.');
    await expect(database.game.get(game.id)).resolves.toBeUndefined();
  });

  test('seeds one stable user for each fake provider', async () => {
    const googleAccount = await database.users.findByIdentity(
      'google',
      FAKE_PROVIDER_SUBJECTS.google
    );
    const telegramAccount = await database.users.findByIdentity(
      'telegram',
      FAKE_PROVIDER_SUBJECTS.telegram
    );
    const yandexAccount = await database.users.findByIdentity(
      'yandex',
      FAKE_PROVIDER_SUBJECTS.yandex
    );

    expect([
      googleAccount?.user.id,
      telegramAccount?.user.id,
      yandexAccount?.user.id,
    ]).toEqual([
      FAKE_SEED_IDENTIFIERS.googleUser,
      FAKE_SEED_IDENTIFIERS.telegramUser,
      FAKE_SEED_IDENTIFIERS.yandexUser,
    ]);
  });

  test('uses provider-specific display names for fake users', async () => {
    const googleAccount = await database.users.findByIdentity(
      'google',
      FAKE_PROVIDER_SUBJECTS.google
    );
    const telegramAccount = await database.users.findByIdentity(
      'telegram',
      FAKE_PROVIDER_SUBJECTS.telegram
    );
    const yandexAccount = await database.users.findByIdentity(
      'yandex',
      FAKE_PROVIDER_SUBJECTS.yandex
    );

    expect([
      googleAccount?.user.displayName,
      telegramAccount?.user.displayName,
      yandexAccount?.user.displayName,
    ]).toEqual(['G User', 'T User', 'Y User']);
  });

  test('rejects a duplicate provider identity without an index', async () => {
    const user = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      displayName: 'Duplicate Google user',
      id: 'duplicate-google-user',
    };
    const identity = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      id: 'duplicate-google-identity',
      provider: 'google' as const,
      providerSubject: FAKE_PROVIDER_SUBJECTS.google,
      userId: user.id,
    };

    await expect(
      database.users.saveWithIdentity(user, identity)
    ).rejects.toThrow('Fake provider identity must be unique.');
  });

  test('rejects duplicate player positions without an index', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 0,
      finishedAt: null,
      id: 'duplicate-seat-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };

    await expect(
      database.games.saveChanges({
        events: [],
        game,
        participants: [
          {
            gameId: game.id,
            role: 'player',
            seat: 1,
            team: 'white',
            userId: FAKE_SEED_IDENTIFIERS.googleUser,
          },
          {
            gameId: game.id,
            role: 'player',
            seat: 1,
            team: 'white',
            userId: FAKE_SEED_IDENTIFIERS.telegramUser,
          },
        ],
      })
    ).rejects.toThrow('A fake player position must be unique within a game.');
  });

  test('allows the same seat number in opposing teams', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 0,
      finishedAt: null,
      id: 'opposing-team-seats-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };

    await database.games.saveChanges({
      events: [],
      game,
      participants: [
        {
          gameId: game.id,
          role: 'player',
          seat: 1,
          team: 'white',
          userId: FAKE_SEED_IDENTIFIERS.googleUser,
        },
        {
          gameId: game.id,
          role: 'player',
          seat: 1,
          team: 'black',
          userId: FAKE_SEED_IDENTIFIERS.telegramUser,
        },
      ],
    });

    await expect(
      database.games.listParticipants(game.id)
    ).resolves.toHaveLength(2);
  });

  test('rejects a player seat without a team', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 0,
      finishedAt: null,
      id: 'seat-without-team-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };

    await expect(
      database.games.saveChanges({
        events: [],
        game,
        participants: [
          {
            gameId: game.id,
            role: 'player',
            seat: 1,
            team: null,
            userId: FAKE_SEED_IDENTIFIERS.googleUser,
          },
        ],
      })
    ).rejects.toThrow(
      'A fake participant seat and team must be selected together.'
    );
  });

  test('rejects a player team without a seat', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 0,
      finishedAt: null,
      id: 'team-without-seat-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };

    await expect(
      database.games.saveChanges({
        events: [],
        game,
        participants: [
          {
            gameId: game.id,
            role: 'player',
            seat: null,
            team: 'white',
            userId: FAKE_SEED_IDENTIFIERS.googleUser,
          },
        ],
      })
    ).rejects.toThrow(
      'A fake participant seat and team must be selected together.'
    );
  });

  test('rejects a player position assigned to a spectator', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 0,
      finishedAt: null,
      id: 'spectator-team-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };

    await expect(
      database.games.saveChanges({
        events: [],
        game,
        participants: [
          {
            gameId: game.id,
            role: 'spectator',
            seat: 1,
            team: 'white',
            userId: FAKE_SEED_IDENTIFIERS.googleUser,
          },
        ],
      })
    ).rejects.toThrow('A fake spectator cannot occupy a player position.');
  });

  test('preserves changed application flags when the database reopens', async () => {
    const featureFlags = {
      gameHistory: false,
      spectatorMode: false,
    };
    await database.featureFlags.setApplication(featureFlags);
    database.close();

    database = await createFakeDatabase({ name: databaseName });

    await expect(database.featureFlags.getApplication()).resolves.toEqual(
      featureFlags
    );
  });

  test('returns a valid session as active', async () => {
    await database.sessions.save({
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      expiresAt: new Date('2026-08-03T12:00:00.000Z'),
      id: 'active-session',
      revokedAt: null,
      userId: FAKE_SEED_IDENTIFIERS.googleUser,
    });

    await expect(
      database.sessions.findActive(
        'active-session',
        new Date('2026-08-03T11:00:00.000Z')
      )
    ).resolves.toMatchObject({ id: 'active-session' });
  });

  test('does not return an expired session as active', async () => {
    await database.sessions.save({
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      expiresAt: new Date('2026-08-03T12:00:00.000Z'),
      id: 'expired-session',
      revokedAt: null,
      userId: FAKE_SEED_IDENTIFIERS.googleUser,
    });

    await expect(
      database.sessions.findActive(
        'expired-session',
        new Date('2026-08-03T12:00:00.000Z')
      )
    ).resolves.toBeNull();
  });

  test('does not return a revoked session as active', async () => {
    await database.sessions.save({
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      expiresAt: new Date('2026-08-03T12:00:00.000Z'),
      id: 'revoked-session',
      revokedAt: null,
      userId: FAKE_SEED_IDENTIFIERS.googleUser,
    });

    await database.sessions.revoke(
      'revoked-session',
      new Date('2026-08-03T11:30:00.000Z')
    );

    await expect(
      database.sessions.findActive(
        'revoked-session',
        new Date('2026-08-03T11:45:00.000Z')
      )
    ).resolves.toBeNull();
  });

  test('reads game events after a requested sequence in order', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 2,
      finishedAt: null,
      id: 'game-with-events',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };
    const firstEvent: FakeGameEvent = {
      commandId: null,
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      gameId: game.id,
      id: 'first-event',
      payload: { featureFlags: {}, rulesVersion: 1 },
      sequence: 1,
      type: 'GameCreated',
      version: 1,
    };
    const secondEvent: FakeGameEvent = {
      commandId: null,
      createdAt: new Date('2026-08-03T10:01:00.000Z'),
      gameId: game.id,
      id: 'second-event',
      payload: { playerId: FAKE_SEED_IDENTIFIERS.googleUser, seat: 1 },
      sequence: 2,
      type: 'PlayerJoined',
      version: 1,
    };
    await database.games.saveChanges({
      events: [secondEvent, firstEvent],
      game,
    });

    const events = await database.games.getEvents(game.id, 1);

    expect(events.map((event) => event.sequence)).toEqual([2]);
  });

  test('rolls back all game changes when a command was already processed', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 1,
      finishedAt: null,
      id: 'atomic-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };
    const gameCreatedEvent: FakeGameEvent = {
      commandId: null,
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      gameId: game.id,
      id: 'atomic-game-created',
      payload: { featureFlags: {}, rulesVersion: 1 },
      sequence: 1,
      type: 'GameCreated',
      version: 1,
    };
    await database.games.saveChanges({ events: [gameCreatedEvent], game });
    const processedCommand = {
      commandType: 'JoinGame',
      gameId: game.id,
      id: 'duplicate-command',
      processedAt: new Date('2026-08-03T10:01:00.000Z'),
      userId: FAKE_SEED_IDENTIFIERS.googleUser,
    };
    const playerJoinedEvent: FakeGameEvent = {
      commandId: processedCommand.id,
      createdAt: new Date('2026-08-03T10:01:00.000Z'),
      gameId: game.id,
      id: 'atomic-player-joined',
      payload: { playerId: FAKE_SEED_IDENTIFIERS.googleUser, seat: 1 },
      sequence: 2,
      type: 'PlayerJoined',
      version: 1,
    };
    const updatedGame = { ...game, currentVersion: 2 };
    await database.games.saveChanges({
      events: [playerJoinedEvent],
      game: updatedGame,
      processedCommand,
    });

    await expect(
      database.games.saveChanges({
        events: [
          {
            ...playerJoinedEvent,
            id: 'event-that-must-be-rolled-back',
            sequence: 3,
          },
        ],
        game: { ...game, currentVersion: 3 },
        processedCommand,
      })
    ).rejects.toBeDefined();
    await expect(database.games.getById(game.id)).resolves.toMatchObject({
      currentVersion: 2,
    });
    await expect(database.games.getEvents(game.id)).resolves.toHaveLength(2);
  });

  test('replaces only feature flags in the saved GameCreated event', async () => {
    const game: FakeGame = {
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      currentVersion: 1,
      finishedAt: null,
      id: 'feature-flags-game',
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };
    await database.games.saveChanges({
      events: [
        {
          commandId: null,
          createdAt: game.createdAt,
          gameId: game.id,
          id: 'feature-flags-event',
          payload: { featureFlags: { oldFlag: true }, rulesVersion: 1 },
          sequence: 1,
          type: 'GameCreated',
          version: 1,
        },
      ],
      game,
    });

    await database.games.replaceFeatureFlags(game.id, { newFlag: true });

    const [gameCreatedEvent] = await database.games.getEvents(game.id);
    expect(gameCreatedEvent?.payload).toEqual({
      featureFlags: { newFlag: true },
      rulesVersion: 1,
    });
  });

  test('reset removes mutable data and restores initial fixtures', async () => {
    await database.sessions.save({
      createdAt: new Date('2026-08-03T10:00:00.000Z'),
      expiresAt: new Date('2026-08-04T10:00:00.000Z'),
      id: 'session-to-reset',
      revokedAt: null,
      userId: FAKE_SEED_IDENTIFIERS.googleUser,
    });
    await database.featureFlags.setApplication({ changedFlag: true });

    await database.reset();

    await expect(
      database.sessions.getById('session-to-reset')
    ).resolves.toBeNull();
    await expect(database.featureFlags.getApplication()).resolves.toEqual(
      DEFAULT_FAKE_FEATURE_FLAGS
    );
    await expect(
      database.users.findByIdentity('google', FAKE_PROVIDER_SUBJECTS.google)
    ).resolves.toMatchObject({
      user: { id: FAKE_SEED_IDENTIFIERS.googleUser },
    });
  });
});
