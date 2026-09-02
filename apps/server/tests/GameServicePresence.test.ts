import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { type GameEventData, restoreGame } from '@war-chest/game-engine';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { FeatureFlagsService } from '../src/featureFlags/FeatureFlagsService.js';
import {
  type ActiveGames,
  createActiveGames,
} from '../src/games/ActiveGames.js';
import type { GameRepository } from '../src/games/GameRepository.js';
import {
  type GameService,
  createGameService,
} from '../src/games/GameService.js';

const GAME_ID = '20000000-0000-4000-8000-000000000001';
const FIRST_USER_ID = '10000000-0000-4000-8000-000000000001';
const SECOND_USER_ID = '10000000-0000-4000-8000-000000000002';
const DISCONNECTED_PLAYER_TIMEOUT_MS = 15 * 60 * 1000;
const EMPTY_WAITING_GAME_TIMEOUT_MS = 10 * 60 * 1000;
const RECONNECT_DEADLINE_RETRY_DELAY_MS = 1_000;
const CURRENT_TIME = new Date('2026-08-16T12:00:00.000Z');
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

describe('GameService presence', () => {
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
      listGamePlayers: vi.fn(),
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
    vi.mocked(gameRepository.listGamePlayers).mockResolvedValue([]);
    vi.mocked(gameRepository.listLobbyGames).mockResolvedValue([]);
  });

  afterEach(() => {
    gameService.close();
    vi.useRealTimers();
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
});
