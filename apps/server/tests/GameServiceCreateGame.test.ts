import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { type GameEventData, applyEvent } from '@war-chest/game-engine';
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

describe('GameService createGame', () => {
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
});
