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
  createGameService,
} from '../src/games/GameService.js';

const GAME_ID = '20000000-0000-4000-8000-000000000001';
const FIRST_USER_ID = '10000000-0000-4000-8000-000000000001';
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

describe('GameService runtime loading and queries', () => {
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
  test('maps stored unfinished games to the public lobby contract', async () => {
    vi.mocked(gameRepository.listLobbyGames).mockResolvedValue([
      {
        createdAt: CURRENT_TIME,
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

  test('returns public player profiles with a game snapshot', async () => {
    activeGames.store(GAME_ID, applyEvent(null, GAME_CREATED_EVENT));
    vi.mocked(gameRepository.listGamePlayers).mockResolvedValue([
      {
        avatarVersion: 'avatar-hash',
        displayName: 'Ada',
        id: FIRST_USER_ID,
        seat: 1,
        team: 'white',
      },
    ]);

    const result = await gameService.getSnapshot({
      gameId: GAME_ID,
      userId: SPECTATOR_USER_ID,
    });

    expect(result).toMatchObject({
      players: [
        {
          avatarVersion: 'avatar-hash',
          displayName: 'Ada',
          id: FIRST_USER_ID,
          seat: 1,
          team: 'white',
        },
      ],
      status: 'found',
    });
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
});
