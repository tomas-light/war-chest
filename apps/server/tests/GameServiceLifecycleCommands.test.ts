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
const GAME_STARTED_EVENT: GameEventData = {
  payload: { firstPlayerId: FIRST_USER_ID },
  sequence: 4,
  type: 'GameStarted',
  version: 1,
};

describe('GameService lifecycle commands', () => {
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
});
