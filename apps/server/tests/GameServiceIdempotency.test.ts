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
const SECOND_COMMAND_ID = '30000000-0000-4000-8000-000000000002';
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

describe('GameService command idempotency', () => {
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
});
