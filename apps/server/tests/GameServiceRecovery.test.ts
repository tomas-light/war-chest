import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { type GameEventData } from '@war-chest/game-engine';
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
const FIRST_USER_ID = '10000000-0000-4000-8000-000000000001';
const SECOND_USER_ID = '10000000-0000-4000-8000-000000000002';
const DISCONNECTED_PLAYER_TIMEOUT_MS = 15 * 60 * 1000;
const EMPTY_WAITING_GAME_TIMEOUT_MS = 10 * 60 * 1000;
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

describe('GameService recovery', () => {
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
