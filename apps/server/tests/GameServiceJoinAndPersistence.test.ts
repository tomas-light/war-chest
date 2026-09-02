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
  createGameService,
} from '../src/games/GameService.js';

const GAME_ID = '20000000-0000-4000-8000-000000000001';
const OTHER_GAME_ID = '20000000-0000-4000-8000-000000000002';
const COMMAND_ID = '30000000-0000-4000-8000-000000000001';
const FIRST_USER_ID = '10000000-0000-4000-8000-000000000001';
const SECOND_USER_ID = '10000000-0000-4000-8000-000000000002';
const SPECTATOR_USER_ID = '10000000-0000-4000-8000-000000000003';
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

describe('GameService join and persistence', () => {
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
});
