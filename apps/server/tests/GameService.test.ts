import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import {
  type GameEventData,
  applyEvent,
  restoreGame,
} from '@war-chest/game-engine';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { FeatureFlagsService } from '../src/featureFlags/FeatureFlagsService.js';
import {
  type ActiveGames,
  createActiveGames,
} from '../src/games/ActiveGames.js';
import type { GameRepository } from '../src/games/GameRepository.js';
import {
  type GameService,
  type GameUpdate,
  createGameService,
} from '../src/games/GameService.js';

const GAME_ID = '20000000-0000-4000-8000-000000000001';
const OTHER_GAME_ID = '20000000-0000-4000-8000-000000000002';
const COMMAND_ID = '30000000-0000-4000-8000-000000000001';
const SECOND_COMMAND_ID = '30000000-0000-4000-8000-000000000002';
const FIRST_USER_ID = '10000000-0000-4000-8000-000000000001';
const SECOND_USER_ID = '10000000-0000-4000-8000-000000000002';
const SPECTATOR_USER_ID = '10000000-0000-4000-8000-000000000003';
const DISCONNECTED_PLAYER_TIMEOUT_MS = 15 * 60 * 1000;
const EMPTY_WAITING_GAME_TIMEOUT_MS = 10 * 60 * 1000;
const RECONNECT_DEADLINE_RETRY_DELAY_MS = 1_000;
const CURRENT_TIME = new Date('2026-08-16T12:00:00.000Z');
const CREATE_REQUEST_HASH =
  'bdea43dc54d89791fa249a3ef1786b10e6cfe2be12570ab18fbb1a77b5161e02';
const GAME_CREATED_EVENT: GameEventData = {
  payload: {
    creatorId: FIRST_USER_ID,
    featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
    rulesVersion: 1,
  },
  sequence: 1,
  type: 'GameCreated',
  version: 1,
};
const FIRST_PLAYER_JOINED_EVENT: GameEventData = {
  payload: { playerId: FIRST_USER_ID, seat: 1, team: 'white' },
  sequence: 2,
  type: 'PlayerJoined',
  version: 1,
};
const SECOND_PLAYER_JOINED_EVENT: GameEventData = {
  payload: { playerId: SECOND_USER_ID, seat: 1, team: 'black' },
  sequence: 3,
  type: 'PlayerJoined',
  version: 1,
};
const GAME_STARTED_EVENT: GameEventData = {
  payload: { firstPlayerId: FIRST_USER_ID },
  sequence: 4,
  type: 'GameStarted',
  version: 1,
};
const TEST_MOVE_EVENT: GameEventData = {
  payload: {
    moveNumber: 1,
    nextPlayerId: SECOND_USER_ID,
    playerId: FIRST_USER_ID,
    privateData: { card: 'hidden' },
  },
  sequence: 5,
  type: 'TestMovePerformed',
  version: 1,
};

describe('GameService', () => {
  let activeGames: ActiveGames;
  let featureFlagsService: FeatureFlagsService;
  let gameRepository: GameRepository;
  let gameService: GameService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(CURRENT_TIME);
    activeGames = createActiveGames();
    featureFlagsService = { read: vi.fn() };
    gameRepository = {
      createGame: vi.fn(),
      deleteExpiredWaitingGame: vi.fn(),
      deleteWaitingGame: vi.fn(),
      findActiveGameIds: vi.fn(),
      findCurrentPlayerGame: vi.fn(),
      findGame: vi.fn(),
      findParticipant: vi.fn(),
      findProcessedCommand: vi.fn(),
      listEmptyWaitingGames: vi.fn(),
      listLobbyGames: vi.fn(),
      loadEvents: vi.fn(),
      saveCommand: vi.fn(),
      saveSystemEvents: vi.fn(),
    };
    gameService = createGameService({
      activeGames,
      disconnectedPlayerTimeoutMs: DISCONNECTED_PLAYER_TIMEOUT_MS,
      emptyWaitingGameTimeoutMs: EMPTY_WAITING_GAME_TIMEOUT_MS,
      featureFlagsService,
      gameRepository,
    });
    vi.mocked(gameRepository.deleteExpiredWaitingGame).mockResolvedValue({
      status: 'deleted',
    });
    vi.mocked(gameRepository.findProcessedCommand).mockResolvedValue(null);
    vi.mocked(gameRepository.findActiveGameIds).mockResolvedValue([]);
    vi.mocked(gameRepository.findCurrentPlayerGame).mockResolvedValue(null);
    vi.mocked(gameRepository.findParticipant).mockResolvedValue(null);
    vi.mocked(gameRepository.listEmptyWaitingGames).mockResolvedValue([]);
    vi.mocked(gameRepository.listLobbyGames).mockResolvedValue([]);
  });

  afterEach(() => {
    gameService.close();
    vi.useRealTimers();
  });

  test('reads runtime flags and persists their GameCreated event', async () => {
    vi.mocked(featureFlagsService.read).mockResolvedValue(
      DEFAULT_RUNTIME_FEATURE_FLAGS
    );
    vi.mocked(gameRepository.createGame).mockResolvedValue({
      createdAt: CURRENT_TIME,
      gameId: GAME_ID,
      status: 'created',
    });

    const result = await gameService.createGame({
      commandId: COMMAND_ID,
      userId: FIRST_USER_ID,
    });

    expect(gameRepository.createGame).toHaveBeenCalledWith({
      commandId: COMMAND_ID,
      creatorUserId: FIRST_USER_ID,
      event: GAME_CREATED_EVENT,
      requestHash: CREATE_REQUEST_HASH,
    });
    expect(result).toMatchObject({
      gameId: GAME_ID,
      status: 'created',
      view: {
        featureFlags: { spectatorMode: true },
        lastEventSequence: 1,
        players: [],
      },
    });
  });

  test('reads runtime flags again for every create request', async () => {
    vi.mocked(featureFlagsService.read)
      .mockResolvedValueOnce({
        ...DEFAULT_RUNTIME_FEATURE_FLAGS,
        gameHistory: false,
      })
      .mockResolvedValueOnce(DEFAULT_RUNTIME_FEATURE_FLAGS);
    vi.mocked(gameRepository.createGame)
      .mockResolvedValueOnce({
        createdAt: CURRENT_TIME,
        gameId: GAME_ID,
        status: 'created',
      })
      .mockResolvedValueOnce({ status: 'commandIdConflict' });

    await gameService.createGame({
      commandId: COMMAND_ID,
      userId: FIRST_USER_ID,
    });
    await gameService.createGame({
      commandId: SECOND_COMMAND_ID,
      userId: FIRST_USER_ID,
    });

    expect(featureFlagsService.read).toHaveBeenCalledTimes(2);
  });

  test('publishes a lobby update after creating a game', async () => {
    vi.mocked(featureFlagsService.read).mockResolvedValue(
      DEFAULT_RUNTIME_FEATURE_FLAGS
    );
    vi.mocked(gameRepository.createGame).mockResolvedValue({
      createdAt: CURRENT_TIME,
      gameId: GAME_ID,
      status: 'created',
    });
    const listener = vi.fn();
    gameService.subscribe(listener);

    await gameService.createGame({
      commandId: COMMAND_ID,
      userId: FIRST_USER_ID,
    });

    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalledWith({
        gameId: GAME_ID,
        previousVersion: 0,
      });
    });
  });

  test('deletes a newly created empty waiting game after its timeout', async () => {
    vi.mocked(featureFlagsService.read).mockResolvedValue(
      DEFAULT_RUNTIME_FEATURE_FLAGS
    );
    vi.mocked(gameRepository.createGame).mockResolvedValue({
      createdAt: CURRENT_TIME,
      gameId: GAME_ID,
      status: 'created',
    });
    await gameService.createGame({
      commandId: COMMAND_ID,
      userId: FIRST_USER_ID,
    });
    const deletionUpdate = new Promise<GameUpdate>((resolve) => {
      gameService.subscribe(resolve);
    });

    await vi.advanceTimersByTimeAsync(EMPTY_WAITING_GAME_TIMEOUT_MS - 1);
    expect(gameRepository.deleteExpiredWaitingGame).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await deletionUpdate;

    expect(gameRepository.deleteExpiredWaitingGame).toHaveBeenCalledWith({
      expiredBefore: CURRENT_TIME,
      gameId: GAME_ID,
    });
    expect(activeGames.get(GAME_ID)).toBeNull();
  });

  test('keeps a waiting game after a player takes a seat', async () => {
    vi.mocked(featureFlagsService.read).mockResolvedValue(
      DEFAULT_RUNTIME_FEATURE_FLAGS
    );
    vi.mocked(gameRepository.createGame).mockResolvedValue({
      createdAt: CURRENT_TIME,
      gameId: GAME_ID,
      status: 'created',
    });
    vi.mocked(gameRepository.saveCommand).mockResolvedValue({
      currentVersion: 2,
      status: 'saved',
    });
    await gameService.createGame({
      commandId: COMMAND_ID,
      userId: FIRST_USER_ID,
    });

    await gameService.executeCommand({
      command: { seat: 1, team: 'white', type: 'JoinGame' },
      commandId: SECOND_COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });
    await vi.advanceTimersByTimeAsync(EMPTY_WAITING_GAME_TIMEOUT_MS);

    expect(gameRepository.deleteExpiredWaitingGame).not.toHaveBeenCalled();
    expect(activeGames.get(GAME_ID)?.state.players).toHaveLength(1);
  });

  test('retries empty waiting game deletion after a transient failure', async () => {
    vi.mocked(featureFlagsService.read).mockResolvedValue(
      DEFAULT_RUNTIME_FEATURE_FLAGS
    );
    vi.mocked(gameRepository.createGame).mockResolvedValue({
      createdAt: CURRENT_TIME,
      gameId: GAME_ID,
      status: 'created',
    });
    vi.mocked(gameRepository.deleteExpiredWaitingGame)
      .mockRejectedValueOnce(
        new Error('PostgreSQL is temporarily unavailable.')
      )
      .mockResolvedValueOnce({ status: 'deleted' });
    await gameService.createGame({
      commandId: COMMAND_ID,
      userId: FIRST_USER_ID,
    });
    const deletionUpdate = new Promise<GameUpdate>((resolve) => {
      gameService.subscribe(resolve);
    });

    await vi.advanceTimersByTimeAsync(EMPTY_WAITING_GAME_TIMEOUT_MS);
    expect(gameRepository.deleteExpiredWaitingGame).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(RECONNECT_DEADLINE_RETRY_DELAY_MS - 1);
    expect(gameRepository.deleteExpiredWaitingGame).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await deletionUpdate;

    expect(gameRepository.deleteExpiredWaitingGame).toHaveBeenCalledTimes(2);
    expect(activeGames.get(GAME_ID)).toBeNull();
  });

  test('returns a duplicate create result without reading unavailable runtime flags', async () => {
    activeGames.store(GAME_ID, applyEvent(null, GAME_CREATED_EVENT));
    vi.mocked(gameRepository.findProcessedCommand).mockResolvedValue({
      commandType: 'CreateGame',
      gameId: GAME_ID,
      requestHash: CREATE_REQUEST_HASH,
      userId: FIRST_USER_ID,
    });
    vi.mocked(featureFlagsService.read).mockRejectedValue(
      new Error('Feature flags are unavailable.')
    );

    const result = await gameService.createGame({
      commandId: COMMAND_ID,
      userId: FIRST_USER_ID,
    });

    expect(result).toMatchObject({
      gameId: GAME_ID,
      status: 'duplicateCommand',
      view: { featureFlags: { spectatorMode: true } },
    });
    expect(featureFlagsService.read).not.toHaveBeenCalled();
    expect(gameRepository.createGame).not.toHaveBeenCalled();
  });

  test('reports a create command id conflict before reading runtime flags', async () => {
    vi.mocked(gameRepository.findProcessedCommand).mockResolvedValue({
      commandType: 'CreateGame',
      gameId: GAME_ID,
      requestHash: CREATE_REQUEST_HASH,
      userId: SECOND_USER_ID,
    });

    const result = await gameService.createGame({
      commandId: COMMAND_ID,
      userId: FIRST_USER_ID,
    });

    expect(result).toEqual({ status: 'commandIdConflict' });
    expect(featureFlagsService.read).not.toHaveBeenCalled();
    expect(gameRepository.createGame).not.toHaveBeenCalled();
  });

  test('does not create another game for a current player', async () => {
    vi.mocked(gameRepository.findCurrentPlayerGame).mockResolvedValue(
      OTHER_GAME_ID
    );

    const result = await gameService.createGame({
      commandId: COMMAND_ID,
      userId: FIRST_USER_ID,
    });

    expect(result).toEqual({
      gameId: OTHER_GAME_ID,
      status: 'playerAlreadyInGame',
    });
    expect(featureFlagsService.read).not.toHaveBeenCalled();
    expect(gameRepository.createGame).not.toHaveBeenCalled();
  });

  test('maps stored unfinished games to the public lobby contract', async () => {
    vi.mocked(gameRepository.listLobbyGames).mockResolvedValue([
      {
        createdAt: CURRENT_TIME,
        id: GAME_ID,
        players: [
          {
            avatarHash: 'avatar-hash',
            displayName: 'Ada',
            id: FIRST_USER_ID,
            seat: 1,
            team: 'white',
          },
        ],
        startedAt: null,
        status: 'waiting',
      },
    ]);

    const result = await gameService.listLobbyGames({ userId: FIRST_USER_ID });

    expect(result).toEqual({
      currentPlayerGameId: null,
      items: [
        {
          createdAt: CURRENT_TIME.toISOString(),
          id: GAME_ID,
          players: [
            {
              avatarVersion: 'avatar-hash',
              displayName: 'Ada',
              id: FIRST_USER_ID,
              seat: 1,
              team: 'white',
            },
          ],
          startedAt: null,
          status: 'waiting',
        },
      ],
    });
  });

  test('does not read runtime flags when restoring an existing game', async () => {
    vi.mocked(gameRepository.findGame).mockResolvedValue({
      createdAt: new Date(),
      currentVersion: 1,
      finishedAt: null,
      id: GAME_ID,
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    });
    vi.mocked(gameRepository.loadEvents).mockResolvedValue([
      GAME_CREATED_EVENT,
    ]);

    await gameService.getSnapshot({
      gameId: GAME_ID,
      userId: SPECTATOR_USER_ID,
    });

    expect(featureFlagsService.read).not.toHaveBeenCalled();
  });

  test('registers a runtime connection while returning its safe view', async () => {
    activeGames.store(GAME_ID, applyEvent(null, GAME_CREATED_EVENT));

    const result = await gameService.connect({
      connectionId: 'socket-one',
      gameId: GAME_ID,
      userId: SPECTATOR_USER_ID,
    });

    expect(result).toMatchObject({
      status: 'connected',
      view: {
        featureFlags: { spectatorMode: true },
        lastEventSequence: 1,
        status: 'waiting',
      },
    });
    expect(activeGames.get(GAME_ID)?.connectionsByUserId).toEqual(
      new Map([[SPECTATOR_USER_ID, new Set(['socket-one'])]])
    );
  });

  test('removes a runtime connection without changing game state', async () => {
    const state = applyEvent(null, GAME_CREATED_EVENT);
    const activeGame = activeGames.store(GAME_ID, state);
    activeGame.connectionsByUserId.set(
      SPECTATOR_USER_ID,
      new Set(['socket-one'])
    );

    await gameService.disconnect({
      connectionId: 'socket-one',
      gameId: GAME_ID,
      userId: SPECTATOR_USER_ID,
    });

    expect(activeGame.connectionsByUserId).toEqual(new Map());
    expect(activeGame.state).toBe(state);
    expect(gameRepository.saveSystemEvents).not.toHaveBeenCalled();
  });

  test('caches a restored unfinished game', async () => {
    vi.mocked(gameRepository.findGame).mockResolvedValue({
      createdAt: new Date(),
      currentVersion: 1,
      finishedAt: null,
      id: GAME_ID,
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    });
    vi.mocked(gameRepository.loadEvents).mockResolvedValue([
      GAME_CREATED_EVENT,
    ]);

    await gameService.getSnapshot({
      gameId: GAME_ID,
      userId: SPECTATOR_USER_ID,
    });
    await gameService.getSnapshot({
      gameId: GAME_ID,
      userId: SPECTATOR_USER_ID,
    });

    expect(gameRepository.loadEvents).toHaveBeenCalledOnce();
  });

  test('rejects a stored history with a sequence gap', async () => {
    vi.mocked(gameRepository.findGame).mockResolvedValue({
      createdAt: new Date(),
      currentVersion: 3,
      finishedAt: null,
      id: GAME_ID,
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    });
    vi.mocked(gameRepository.loadEvents).mockResolvedValue([
      GAME_CREATED_EVENT,
      { ...FIRST_PLAYER_JOINED_EVENT, sequence: 3 },
    ]);

    await expect(
      gameService.getSnapshot({
        gameId: GAME_ID,
        userId: SPECTATOR_USER_ID,
      })
    ).rejects.toThrow('has a sequence gap');
  });

  test('forbids a game command from a spectator', async () => {
    activeGames.store(GAME_ID, applyEvent(null, GAME_CREATED_EVENT));

    const result = await gameService.executeCommand({
      command: { type: 'StartGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
      userId: SPECTATOR_USER_ID,
    });

    expect(result).toEqual({ status: 'gameCommandForbidden' });
  });

  test('deletes a waiting game when its creator closes the lobby', async () => {
    activeGames.store(GAME_ID, applyEvent(null, GAME_CREATED_EVENT));
    vi.mocked(gameRepository.deleteWaitingGame).mockResolvedValue({
      status: 'deleted',
    });

    const result = await gameService.executeCommand({
      command: { type: 'LeaveGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(gameRepository.deleteWaitingGame).toHaveBeenCalledWith({
      expectedVersion: 1,
      gameId: GAME_ID,
    });
    expect(result).toEqual({ status: 'gameDeleted' });
    expect(activeGames.get(GAME_ID)).toBeNull();
  });

  test('removes a joined non-creator from waiting game projections', async () => {
    const secondPlayerJoinedEvent: GameEventData = {
      ...SECOND_PLAYER_JOINED_EVENT,
      sequence: 2,
    };
    const state = restoreGame([GAME_CREATED_EVENT, secondPlayerJoinedEvent]);

    if (state === null) {
      throw new Error('Expected a restored waiting state.');
    }

    activeGames.store(GAME_ID, state);
    vi.mocked(gameRepository.findParticipant).mockResolvedValue({
      gameId: GAME_ID,
      seat: 1,
      team: 'black',
      userId: SECOND_USER_ID,
    });
    vi.mocked(gameRepository.saveCommand).mockResolvedValue({
      currentVersion: 3,
      status: 'saved',
    });

    const result = await gameService.executeCommand({
      command: { type: 'LeaveGame' },
      commandId: COMMAND_ID,
      expectedVersion: 2,
      gameId: GAME_ID,
      userId: SECOND_USER_ID,
    });

    expect(gameRepository.saveCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        participantChanges: [
          { operation: 'removePlayer', userId: SECOND_USER_ID },
        ],
      })
    );
    expect(result).toMatchObject({
      status: 'saved',
      view: { players: [], status: 'waiting' },
    });
  });

  test('persists defeat and opponent victory after a non-current player surrenders', async () => {
    const state = restoreGame([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
      GAME_STARTED_EVENT,
    ]);

    if (state === null) {
      throw new Error('Expected a restored active state.');
    }

    activeGames.store(GAME_ID, state);
    vi.mocked(gameRepository.findParticipant).mockResolvedValue({
      gameId: GAME_ID,
      seat: 1,
      team: 'black',
      userId: SECOND_USER_ID,
    });
    vi.mocked(gameRepository.saveCommand).mockResolvedValue({
      currentVersion: 6,
      status: 'saved',
    });

    const result = await gameService.executeCommand({
      command: { type: 'SurrenderGame' },
      commandId: COMMAND_ID,
      expectedVersion: 4,
      gameId: GAME_ID,
      userId: SECOND_USER_ID,
    });

    const savedCommand = vi.mocked(gameRepository.saveCommand).mock
      .calls[0]?.[0];

    expect(savedCommand?.events).toEqual([
      expect.objectContaining({
        payload: { playerId: SECOND_USER_ID, reason: 'surrender' },
        type: 'PlayerDefeated',
      }),
      expect.objectContaining({
        payload: { winnerTeam: 'white' },
        type: 'GameFinished',
      }),
    ]);
    expect(savedCommand?.gameChanges).toMatchObject({
      status: 'finished',
      winnerTeam: 'white',
    });
    expect(result).toMatchObject({
      status: 'saved',
      view: { status: 'finished', winnerTeam: 'white' },
    });
  });

  test('forbids a joined non-creator from starting the game', async () => {
    const state = restoreGame([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
    ]);

    if (state === null) {
      throw new Error('Expected a restored waiting state.');
    }

    activeGames.store(GAME_ID, state);
    vi.mocked(gameRepository.findParticipant).mockResolvedValue({
      gameId: GAME_ID,
      seat: 1,
      team: 'black',
      userId: SECOND_USER_ID,
    });

    const result = await gameService.executeCommand({
      command: { type: 'StartGame' },
      commandId: COMMAND_ID,
      expectedVersion: 3,
      gameId: GAME_ID,
      userId: SECOND_USER_ID,
    });

    expect(result).toEqual({ status: 'gameCommandForbidden' });
    expect(gameRepository.saveCommand).not.toHaveBeenCalled();
  });

  test('allows the creator to start without occupying a position', async () => {
    const creatorOnlyGameCreatedEvent: GameEventData = {
      ...GAME_CREATED_EVENT,
      payload: {
        ...GAME_CREATED_EVENT.payload,
        creatorId: SPECTATOR_USER_ID,
      },
    };
    const state = restoreGame([
      creatorOnlyGameCreatedEvent,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
    ]);

    if (state === null) {
      throw new Error('Expected a restored waiting state.');
    }

    activeGames.store(GAME_ID, state);
    vi.mocked(gameRepository.findParticipant).mockResolvedValue(null);
    vi.mocked(gameRepository.saveCommand).mockResolvedValue({
      currentVersion: 4,
      status: 'saved',
    });

    const result = await gameService.executeCommand({
      command: { type: 'StartGame' },
      commandId: COMMAND_ID,
      expectedVersion: 3,
      gameId: GAME_ID,
      userId: SPECTATOR_USER_ID,
    });

    expect(result).toMatchObject({
      status: 'saved',
      view: { privateMoves: [], status: 'active' },
    });
  });

  test('persists a creator swap for both occupied positions', async () => {
    const state = restoreGame([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
    ]);

    if (state === null) {
      throw new Error('Expected a restored waiting state.');
    }

    activeGames.store(GAME_ID, state);
    vi.mocked(gameRepository.findParticipant).mockResolvedValue({
      gameId: GAME_ID,
      seat: 1,
      team: 'white',
      userId: FIRST_USER_ID,
    });
    vi.mocked(gameRepository.saveCommand).mockResolvedValue({
      currentVersion: 4,
      status: 'saved',
    });

    const result = await gameService.executeCommand({
      command: { type: 'SwapPlayerPositions' },
      commandId: COMMAND_ID,
      expectedVersion: 3,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(gameRepository.saveCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        participantChanges: [
          {
            operation: 'swapPlayers',
            positions: [
              { seat: 1, team: 'black', userId: FIRST_USER_ID },
              { seat: 1, team: 'white', userId: SECOND_USER_ID },
            ],
          },
        ],
      })
    );
    expect(result).toMatchObject({
      status: 'saved',
      view: {
        players: [
          expect.objectContaining({ id: FIRST_USER_ID, team: 'black' }),
          expect.objectContaining({ id: SECOND_USER_ID, team: 'white' }),
        ],
      },
    });
  });

  test('forbids a joined non-creator from swapping positions', async () => {
    const state = restoreGame([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
    ]);

    if (state === null) {
      throw new Error('Expected a restored waiting state.');
    }

    activeGames.store(GAME_ID, state);
    vi.mocked(gameRepository.findParticipant).mockResolvedValue({
      gameId: GAME_ID,
      seat: 1,
      team: 'black',
      userId: SECOND_USER_ID,
    });

    const result = await gameService.executeCommand({
      command: { type: 'SwapPlayerPositions' },
      commandId: COMMAND_ID,
      expectedVersion: 3,
      gameId: GAME_ID,
      userId: SECOND_USER_ID,
    });

    expect(result).toEqual({ status: 'gameCommandForbidden' });
    expect(gameRepository.saveCommand).not.toHaveBeenCalled();
  });

  test('reports an occupied position for a joining spectator', async () => {
    const state = restoreGame([GAME_CREATED_EVENT, FIRST_PLAYER_JOINED_EVENT]);

    if (state === null) {
      throw new Error('Expected a restored waiting state.');
    }

    activeGames.store(GAME_ID, state);

    const result = await gameService.executeCommand({
      command: { seat: 1, team: 'white', type: 'JoinGame' },
      commandId: COMMAND_ID,
      expectedVersion: 2,
      gameId: GAME_ID,
      userId: SPECTATOR_USER_ID,
    });

    expect(result).toEqual({ status: 'gamePositionOccupied' });
  });

  test('prevents a player from joining a second unfinished game', async () => {
    activeGames.store(GAME_ID, applyEvent(null, GAME_CREATED_EVENT));
    vi.mocked(gameRepository.findCurrentPlayerGame).mockResolvedValue(
      OTHER_GAME_ID
    );

    const result = await gameService.executeCommand({
      command: { seat: 1, team: 'white', type: 'JoinGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(result).toEqual({
      gameId: OTHER_GAME_ID,
      status: 'playerAlreadyInGame',
    });
    expect(gameRepository.saveCommand).not.toHaveBeenCalled();
  });

  test('does not persist a command rejected by the engine', async () => {
    activeGames.store(GAME_ID, applyEvent(null, GAME_CREATED_EVENT));
    vi.mocked(gameRepository.findParticipant).mockResolvedValue({
      gameId: GAME_ID,
      seat: 1,
      team: 'white',
      userId: FIRST_USER_ID,
    });

    const result = await gameService.executeCommand({
      command: { type: 'StartGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(result).toEqual({ status: 'commandRejected' });
    expect(gameRepository.saveCommand).not.toHaveBeenCalled();
  });

  test('changes live state only after the command commit', async () => {
    const waitingState = restoreGame([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
    ]);

    if (waitingState === null) {
      throw new Error('Expected a restored waiting state.');
    }

    activeGames.store(GAME_ID, waitingState);
    vi.mocked(gameRepository.findParticipant).mockResolvedValue({
      gameId: GAME_ID,
      seat: 1,
      team: 'white',
      userId: FIRST_USER_ID,
    });
    let resolveSave:
      | ((value: { currentVersion: number; status: 'saved' }) => void)
      | undefined;
    vi.mocked(gameRepository.saveCommand).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = resolve;
        })
    );

    const execution = gameService.executeCommand({
      command: { type: 'StartGame' },
      commandId: COMMAND_ID,
      expectedVersion: 3,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });
    await vi.waitFor(() => {
      expect(gameRepository.saveCommand).toHaveBeenCalledOnce();
    });
    expect(activeGames.get(GAME_ID)?.state.status).toBe('waiting');

    resolveSave?.({ currentVersion: 4, status: 'saved' });
    await execution;

    expect(activeGames.get(GAME_ID)?.state.status).toBe('active');
  });

  test('publishes a saved player command to update subscribers', async () => {
    activeGames.store(GAME_ID, applyEvent(null, GAME_CREATED_EVENT));
    const updateListener = vi.fn();
    gameService.subscribe(updateListener);
    vi.mocked(gameRepository.saveCommand).mockResolvedValue({
      currentVersion: 2,
      status: 'saved',
    });

    await gameService.executeCommand({
      command: { seat: 1, team: 'white', type: 'JoinGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(updateListener).toHaveBeenCalledWith({
      gameId: GAME_ID,
      previousVersion: 1,
    });
  });

  test('passes player projection changes to the repository', async () => {
    activeGames.store(GAME_ID, applyEvent(null, GAME_CREATED_EVENT));
    vi.mocked(gameRepository.saveCommand).mockResolvedValue({
      currentVersion: 2,
      status: 'saved',
    });

    await gameService.executeCommand({
      command: { seat: 1, team: 'white', type: 'JoinGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(gameRepository.saveCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        participantChanges: [
          {
            operation: 'addPlayer',
            seat: 1,
            team: 'white',
            userId: FIRST_USER_ID,
          },
        ],
      })
    );
  });

  test('persists a position change for an already joined player', async () => {
    const waitingState = restoreGame([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
    ]);

    if (waitingState === null) {
      throw new Error('Expected a restored waiting state.');
    }

    activeGames.store(GAME_ID, waitingState);
    vi.mocked(gameRepository.findParticipant).mockResolvedValue({
      gameId: GAME_ID,
      seat: 1,
      team: 'white',
      userId: FIRST_USER_ID,
    });
    vi.mocked(gameRepository.saveCommand).mockResolvedValue({
      currentVersion: 3,
      status: 'saved',
    });

    const result = await gameService.executeCommand({
      command: { seat: 1, team: 'black', type: 'JoinGame' },
      commandId: COMMAND_ID,
      expectedVersion: 2,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(gameRepository.saveCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        participantChanges: [
          {
            operation: 'movePlayer',
            seat: 1,
            team: 'black',
            userId: FIRST_USER_ID,
          },
        ],
      })
    );
    expect(result).toMatchObject({
      events: [expect.objectContaining({ type: 'PlayerPositionChanged' })],
      view: {
        players: [expect.objectContaining({ team: 'black' })],
        teams: { black: [FIRST_USER_ID], white: [] },
      },
    });
  });

  test('does not execute an exact duplicate command again', async () => {
    activeGames.store(GAME_ID, applyEvent(null, GAME_CREATED_EVENT));
    vi.mocked(gameRepository.saveCommand).mockResolvedValue({
      currentVersion: 2,
      status: 'saved',
    });

    await gameService.executeCommand({
      command: { seat: 1, team: 'white', type: 'JoinGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });
    const savedInput = vi.mocked(gameRepository.saveCommand).mock.calls[0]?.[0];

    if (savedInput === undefined) {
      throw new Error('Expected a saved command input.');
    }

    vi.mocked(gameRepository.findProcessedCommand).mockResolvedValue({
      commandType: 'JoinGame',
      gameId: GAME_ID,
      requestHash: savedInput.requestHash,
      userId: FIRST_USER_ID,
    });
    vi.mocked(gameRepository.findGame).mockResolvedValue({
      createdAt: new Date(),
      currentVersion: 2,
      finishedAt: null,
      id: GAME_ID,
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    });
    vi.mocked(gameRepository.loadEvents).mockImplementation(
      (_gameId, afterSequence = 0) =>
        Promise.resolve(
          [GAME_CREATED_EVENT, FIRST_PLAYER_JOINED_EVENT].filter(
            (event) => event.sequence > afterSequence
          )
        )
    );
    vi.mocked(gameRepository.findParticipant).mockResolvedValue({
      gameId: GAME_ID,
      seat: 1,
      team: 'white',
      userId: FIRST_USER_ID,
    });

    const result = await gameService.executeCommand({
      command: { seat: 1, team: 'white', type: 'JoinGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(result.status).toBe('duplicateCommand');
    expect(gameRepository.saveCommand).toHaveBeenCalledOnce();
  });

  test('preserves runtime connections when refreshing a duplicate', async () => {
    const activeGame = activeGames.store(
      GAME_ID,
      applyEvent(null, GAME_CREATED_EVENT)
    );
    activeGame.connectionsByUserId.set(
      SPECTATOR_USER_ID,
      new Set(['socket-one'])
    );
    vi.mocked(gameRepository.saveCommand).mockResolvedValue({
      currentVersion: 2,
      status: 'duplicateCommand',
    });
    vi.mocked(gameRepository.findGame).mockResolvedValue({
      createdAt: new Date(),
      currentVersion: 2,
      finishedAt: null,
      id: GAME_ID,
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    });
    vi.mocked(gameRepository.loadEvents).mockImplementation(
      (_gameId, afterSequence = 0) =>
        Promise.resolve(
          [GAME_CREATED_EVENT, FIRST_PLAYER_JOINED_EVENT].filter(
            (event) => event.sequence > afterSequence
          )
        )
    );

    await gameService.executeCommand({
      command: { seat: 1, team: 'white', type: 'JoinGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(activeGames.get(GAME_ID)?.connectionsByUserId).toEqual(
      new Map([[SPECTATOR_USER_ID, new Set(['socket-one'])]])
    );
  });

  test('creates the same request hash when JSON keys are reordered', async () => {
    const activeState = restoreGame([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
      GAME_STARTED_EVENT,
    ]);

    if (activeState === null) {
      throw new Error('Expected a restored active state.');
    }

    activeGames.store(GAME_ID, activeState);
    vi.mocked(gameRepository.findParticipant).mockResolvedValue({
      gameId: GAME_ID,
      seat: 1,
      team: 'white',
      userId: FIRST_USER_ID,
    });
    vi.mocked(gameRepository.saveCommand).mockResolvedValue({
      currentVersion: 5,
      status: 'saved',
    });

    await gameService.executeCommand({
      command: {
        privateData: { hand: { first: 'one', second: 'two' } },
        type: 'TestMove',
      },
      commandId: COMMAND_ID,
      expectedVersion: 4,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });
    activeGames.store(GAME_ID, activeState);
    await gameService.executeCommand({
      command: {
        privateData: { hand: { second: 'two', first: 'one' } },
        type: 'TestMove',
      },
      commandId: SECOND_COMMAND_ID,
      expectedVersion: 4,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });
    const [firstSaveCall, secondSaveCall] = vi.mocked(
      gameRepository.saveCommand
    ).mock.calls;

    if (firstSaveCall === undefined || secondSaveCall === undefined) {
      throw new Error('Expected two saved command inputs.');
    }

    expect(secondSaveCall[0].requestHash).toBe(firstSaveCall[0].requestHash);
  });

  test('returns a command id conflict without loading its game', async () => {
    vi.mocked(gameRepository.findProcessedCommand).mockResolvedValue({
      commandType: 'StartGame',
      gameId: '20000000-0000-4000-8000-000000000099',
      requestHash: 'a'.repeat(64),
      userId: SECOND_USER_ID,
    });

    const result = await gameService.executeCommand({
      command: { type: 'StartGame' },
      commandId: COMMAND_ID,
      expectedVersion: 1,
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(result).toEqual({ status: 'commandIdConflict' });
    expect(gameRepository.findGame).not.toHaveBeenCalled();
  });

  test('creates different safe views for player and spectator', async () => {
    const history = [
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
      GAME_STARTED_EVENT,
      TEST_MOVE_EVENT,
    ];
    const state = restoreGame(history);

    if (state === null) {
      throw new Error('Expected a restored active state.');
    }

    activeGames.store(GAME_ID, state);
    vi.mocked(gameRepository.findParticipant).mockImplementation(
      (_gameId, userId) =>
        Promise.resolve(
          userId === FIRST_USER_ID
            ? {
                gameId: GAME_ID,
                seat: 1,
                team: 'white',
                userId,
              }
            : null
        )
    );

    const playerResult = await gameService.getSnapshot({
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });
    const spectatorResult = await gameService.getSnapshot({
      gameId: GAME_ID,
      userId: SPECTATOR_USER_ID,
    });

    expect(
      playerResult.status === 'found' ? playerResult.view.privateMoves : null
    ).toEqual([{ data: { card: 'hidden' }, moveNumber: 1 }]);
    expect(
      spectatorResult.status === 'found'
        ? spectatorResult.view.privateMoves
        : null
    ).toEqual([]);
  });

  test('keeps a player connected while another socket remains', async () => {
    const state = restoreGame([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
      GAME_STARTED_EVENT,
    ]);

    if (state === null) {
      throw new Error('Expected an active game state.');
    }

    const activeGame = activeGames.store(GAME_ID, state);
    activeGame.connectionsByUserId.set(
      FIRST_USER_ID,
      new Set(['socket-one', 'socket-two'])
    );

    const result = await gameService.disconnect({
      connectionId: 'socket-one',
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(result).toEqual({ status: 'noChange' });
    expect(gameRepository.saveSystemEvents).not.toHaveBeenCalled();
  });

  test('persists a deadline when the last player socket disconnects', async () => {
    const state = restoreGame([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
      GAME_STARTED_EVENT,
    ]);

    if (state === null) {
      throw new Error('Expected an active game state.');
    }

    const activeGame = activeGames.store(GAME_ID, state);
    activeGame.connectionsByUserId.set(FIRST_USER_ID, new Set(['socket-one']));
    vi.mocked(gameRepository.saveSystemEvents).mockResolvedValue({
      currentVersion: 5,
      status: 'saved',
    });

    const result = await gameService.disconnect({
      connectionId: 'socket-one',
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(result).toEqual({
      currentVersion: 5,
      previousVersion: 4,
      status: 'disconnected',
    });
    expect(gameRepository.saveSystemEvents).toHaveBeenCalledWith({
      events: [
        expect.objectContaining({
          payload: {
            playerId: FIRST_USER_ID,
            reconnectDeadline: '2026-08-16T12:15:00.000Z',
          },
          type: 'PlayerDisconnected',
        }),
      ],
      expectedVersion: 4,
      gameChanges: undefined,
      gameId: GAME_ID,
    });
    expect(vi.getTimerCount()).toBe(1);
  });

  test('releases the game queue before an asynchronous update is delivered', async () => {
    const state = restoreGame([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
      GAME_STARTED_EVENT,
    ]);

    if (state === null) {
      throw new Error('Expected an active game state.');
    }

    const activeGame = activeGames.store(GAME_ID, state);
    activeGame.connectionsByUserId.set(FIRST_USER_ID, new Set(['socket-one']));
    const updateListener = vi.fn(() => new Promise<void>(() => undefined));
    gameService.subscribe(updateListener);
    vi.mocked(gameRepository.saveSystemEvents).mockResolvedValue({
      currentVersion: 5,
      status: 'saved',
    });

    const result = await gameService.disconnect({
      connectionId: 'socket-one',
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(result.status).toBe('disconnected');
    expect(updateListener).toHaveBeenCalledWith({
      gameId: GAME_ID,
      previousVersion: 4,
    });
  });

  test('reconnects before the deadline and cancels its timer', async () => {
    const state = restoreGame([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
      GAME_STARTED_EVENT,
    ]);

    if (state === null) {
      throw new Error('Expected an active game state.');
    }

    const activeGame = activeGames.store(GAME_ID, state);
    activeGame.connectionsByUserId.set(FIRST_USER_ID, new Set(['socket-one']));
    vi.mocked(gameRepository.saveSystemEvents).mockResolvedValue({
      currentVersion: 5,
      status: 'saved',
    });
    vi.mocked(gameRepository.findParticipant).mockResolvedValue({
      gameId: GAME_ID,
      seat: 1,
      team: 'white',
      userId: FIRST_USER_ID,
    });
    await gameService.disconnect({
      connectionId: 'socket-one',
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });
    vi.setSystemTime('2026-08-16T12:10:00.000Z');

    const result = await gameService.connect({
      connectionId: 'socket-two',
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });

    expect(result.status).toBe('reconnected');

    if (result.status !== 'reconnected') {
      throw new Error('Expected a reconnected result.');
    }

    expect(result).toMatchObject({
      currentVersion: 6,
      previousVersion: 5,
    });
    expect(
      result.view.players.find((player) => player.id === FIRST_USER_ID)
    ).toMatchObject({ presence: 'connected', reconnectDeadline: null });
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(DISCONNECTED_PLAYER_TIMEOUT_MS);
    expect(gameRepository.saveSystemEvents).toHaveBeenCalledTimes(2);
  });

  test('turns an expired deadline into defeat and game finish', async () => {
    const state = restoreGame([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
      GAME_STARTED_EVENT,
    ]);

    if (state === null) {
      throw new Error('Expected an active game state.');
    }

    const activeGame = activeGames.store(GAME_ID, state);
    activeGame.connectionsByUserId.set(FIRST_USER_ID, new Set(['socket-one']));
    vi.mocked(gameRepository.saveSystemEvents).mockResolvedValue({
      currentVersion: 5,
      status: 'saved',
    });
    await gameService.disconnect({
      connectionId: 'socket-one',
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });
    await vi.advanceTimersByTimeAsync(DISCONNECTED_PLAYER_TIMEOUT_MS);

    await vi.waitFor(() => {
      expect(gameRepository.saveSystemEvents).toHaveBeenCalledTimes(2);
    });
    expect(
      vi.mocked(gameRepository.saveSystemEvents).mock.calls[1]?.[0].events
    ).toEqual([
      expect.objectContaining({ type: 'PlayerDefeated' }),
      expect.objectContaining({ type: 'GameFinished' }),
    ]);
    expect(
      vi.mocked(gameRepository.saveSystemEvents).mock.calls[1]?.[0].gameChanges
    ).toEqual({
      finishedAt: new Date('2026-08-16T12:15:00.000Z'),
      status: 'finished',
      winnerTeam: 'black',
    });
    expect(activeGames.get(GAME_ID)).toBeNull();
  });

  test('retries an expired deadline after a transient persistence failure', async () => {
    const state = restoreGame([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
      GAME_STARTED_EVENT,
    ]);

    if (state === null) {
      throw new Error('Expected an active game state.');
    }

    const activeGame = activeGames.store(GAME_ID, state);
    activeGame.connectionsByUserId.set(FIRST_USER_ID, new Set(['socket-one']));
    vi.mocked(gameRepository.saveSystemEvents)
      .mockResolvedValueOnce({ currentVersion: 5, status: 'saved' })
      .mockRejectedValueOnce(
        new Error('PostgreSQL is temporarily unavailable.')
      )
      .mockResolvedValueOnce({ currentVersion: 7, status: 'saved' });
    await gameService.disconnect({
      connectionId: 'socket-one',
      gameId: GAME_ID,
      userId: FIRST_USER_ID,
    });
    await vi.advanceTimersByTimeAsync(DISCONNECTED_PLAYER_TIMEOUT_MS);

    expect(gameRepository.saveSystemEvents).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(RECONNECT_DEADLINE_RETRY_DELAY_MS - 1);
    expect(gameRepository.saveSystemEvents).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);

    expect(gameRepository.saveSystemEvents).toHaveBeenCalledTimes(3);
    expect(activeGames.get(GAME_ID)).toBeNull();
  });

  test('deletes an already expired empty waiting game during recovery', async () => {
    const expiredCreatedAt = new Date(
      CURRENT_TIME.getTime() - EMPTY_WAITING_GAME_TIMEOUT_MS
    );
    vi.mocked(gameRepository.listEmptyWaitingGames).mockResolvedValue([
      { createdAt: expiredCreatedAt, id: GAME_ID },
    ]);
    const deletionUpdate = new Promise<GameUpdate>((resolve) => {
      gameService.subscribe(resolve);
    });

    await gameService.recoverGames();
    await deletionUpdate;

    expect(gameRepository.deleteExpiredWaitingGame).toHaveBeenCalledWith({
      expiredBefore: expiredCreatedAt,
      gameId: GAME_ID,
    });
    expect(gameRepository.findGame).not.toHaveBeenCalled();
  });

  test('restores a future reconnect timer from persisted history', async () => {
    const disconnectedEvent: GameEventData = {
      payload: {
        playerId: FIRST_USER_ID,
        reconnectDeadline: '2026-08-16T12:15:00.000Z',
      },
      sequence: 5,
      type: 'PlayerDisconnected',
      version: 1,
    };
    vi.mocked(gameRepository.findActiveGameIds).mockResolvedValue([GAME_ID]);
    vi.mocked(gameRepository.findGame).mockResolvedValue({
      createdAt: new Date(),
      currentVersion: 5,
      finishedAt: null,
      id: GAME_ID,
      startedAt: new Date(),
      status: 'active',
      winnerTeam: null,
    });
    vi.mocked(gameRepository.loadEvents).mockResolvedValue([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
      GAME_STARTED_EVENT,
      disconnectedEvent,
    ]);

    await gameService.recoverGames();

    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(DISCONNECTED_PLAYER_TIMEOUT_MS - 1);
    expect(gameRepository.saveSystemEvents).not.toHaveBeenCalled();
    expect(activeGames.get(GAME_ID)?.state.players[0]).toMatchObject({
      presence: 'disconnected',
      reconnectDeadline: '2026-08-16T12:15:00.000Z',
    });
  });

  test('processes an already expired deadline during recovery', async () => {
    const disconnectedEvent: GameEventData = {
      payload: {
        playerId: FIRST_USER_ID,
        reconnectDeadline: '2026-08-16T12:15:00.000Z',
      },
      sequence: 5,
      type: 'PlayerDisconnected',
      version: 1,
    };
    vi.setSystemTime('2026-08-16T12:16:00.000Z');
    vi.mocked(gameRepository.findActiveGameIds).mockResolvedValue([GAME_ID]);
    vi.mocked(gameRepository.findGame).mockResolvedValue({
      createdAt: new Date(),
      currentVersion: 5,
      finishedAt: null,
      id: GAME_ID,
      startedAt: new Date(),
      status: 'active',
      winnerTeam: null,
    });
    vi.mocked(gameRepository.loadEvents).mockResolvedValue([
      GAME_CREATED_EVENT,
      FIRST_PLAYER_JOINED_EVENT,
      SECOND_PLAYER_JOINED_EVENT,
      GAME_STARTED_EVENT,
      disconnectedEvent,
    ]);
    vi.mocked(gameRepository.saveSystemEvents).mockResolvedValue({
      currentVersion: 7,
      status: 'saved',
    });

    await gameService.recoverGames();
    await vi.runOnlyPendingTimersAsync();

    await vi.waitFor(() => {
      expect(gameRepository.saveSystemEvents).toHaveBeenCalledOnce();
    });
    expect(
      vi.mocked(gameRepository.saveSystemEvents).mock.calls[0]?.[0].events
    ).toEqual([
      expect.objectContaining({ type: 'PlayerDefeated' }),
      expect.objectContaining({ type: 'GameFinished' }),
    ]);
  });
});
