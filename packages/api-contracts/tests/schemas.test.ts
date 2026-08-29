import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { describe, expect, test } from 'vitest';
import {
  createGameRequestSchema,
  gameCommandMessageSchema,
  gameEventsMessageSchema,
  gameEventsQuerySchema,
  gameJoinMessageSchema,
  googleLoginRequestSchema,
  joinGameRequestSchema,
  leaveGameRequestSchema,
  leaveGameResponseSchema,
  lobbyGamesResponseSchema,
  lobbyUpdatedMessageSchema,
  sessionResponseSchema,
} from '../src/index.js';

const GAME_ID = '20000000-0000-4000-8000-000000000001';
const COMMAND_ID = '30000000-0000-4000-8000-000000000001';

describe('session response contract', () => {
  test('accepts a serialized authenticated session', () => {
    const result = sessionResponseSchema.safeParse({
      expiresAt: '2026-09-03T10:00:00.000Z',
      user: {
        avatarVersion: null,
        displayName: 'Ada',
        id: 'user-1',
      },
    });

    expect(result.success).toBe(true);
  });
});

describe('Google login request contract', () => {
  test('accepts a non-empty ID token', () => {
    const result = googleLoginRequestSchema.safeParse({ idToken: 'id-token' });

    expect(result.success).toBe(true);
  });

  test('rejects an empty ID token', () => {
    const result = googleLoginRequestSchema.safeParse({ idToken: ' ' });

    expect(result.success).toBe(false);
  });
});

describe('game events contract', () => {
  test('accepts an event that moves a player to a free position', () => {
    const result = gameEventsMessageSchema.safeParse({
      events: [
        {
          payload: { playerId: 'user-1', seat: 1, team: 'black' },
          sequence: 3,
          type: 'PlayerPositionChanged',
          version: 1,
        },
      ],
      gameId: GAME_ID,
    });

    expect(result.success).toBe(true);
  });

  test('accepts a player presence event with an ISO reconnect deadline', () => {
    const result = gameEventsMessageSchema.safeParse({
      events: [
        {
          payload: {
            playerId: 'user-1',
            reconnectDeadline: '2026-08-16T12:15:00.000Z',
          },
          sequence: 5,
          type: 'PlayerDisconnected',
          version: 1,
        },
      ],
      gameId: GAME_ID,
    });

    expect(result.success).toBe(true);
  });

  test('accepts a player leaving a waiting game', () => {
    const result = gameEventsMessageSchema.safeParse({
      events: [
        {
          payload: { playerId: 'user-1' },
          sequence: 3,
          type: 'PlayerLeft',
          version: 1,
        },
      ],
      gameId: GAME_ID,
    });

    expect(result.success).toBe(true);
  });

  test('accepts surrender as a public defeat reason', () => {
    const result = gameEventsMessageSchema.safeParse({
      events: [
        {
          payload: { playerId: 'user-1', reason: 'surrender' },
          sequence: 5,
          type: 'PlayerDefeated',
          version: 1,
        },
      ],
      gameId: GAME_ID,
    });

    expect(result.success).toBe(true);
  });

  test('rejects an event with an unsupported version', () => {
    const result = gameEventsMessageSchema.safeParse({
      events: [
        {
          payload: {
            creatorId: 'user-1',
            featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
            rulesVersion: 1,
          },
          sequence: 1,
          type: 'GameCreated',
          version: 2,
        },
      ],
      gameId: GAME_ID,
    });

    expect(result.success).toBe(false);
  });

  test('rejects non-boolean feature flag values', () => {
    const result = gameEventsMessageSchema.safeParse({
      events: [
        {
          payload: {
            creatorId: 'user-1',
            featureFlags: {
              ...DEFAULT_RUNTIME_FEATURE_FLAGS,
              spectatorMode: 2,
            },
            rulesVersion: 1,
          },
          sequence: 1,
          type: 'GameCreated',
          version: 1,
        },
      ],
      gameId: GAME_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe('game client message contracts', () => {
  test('accepts UUID identifiers', () => {
    const result = gameCommandMessageSchema.safeParse({
      command: { type: 'StartGame' },
      commandId: COMMAND_ID,
      expectedVersion: 2,
      gameId: GAME_ID,
    });

    expect(result.success).toBe(true);
  });

  test('accepts the creator position swap command', () => {
    const result = gameCommandMessageSchema.safeParse({
      command: { type: 'SwapPlayerPositions' },
      commandId: COMMAND_ID,
      expectedVersion: 3,
      gameId: GAME_ID,
    });

    expect(result.success).toBe(true);
  });

  test('accepts surrender independently of the current turn', () => {
    const result = gameCommandMessageSchema.safeParse({
      command: { type: 'SurrenderGame' },
      commandId: COMMAND_ID,
      expectedVersion: 4,
      gameId: GAME_ID,
    });

    expect(result.success).toBe(true);
  });

  test('rejects a non-UUID game identifier', () => {
    const result = gameJoinMessageSchema.safeParse({ gameId: 'game-1' });

    expect(result.success).toBe(false);
  });

  test('rejects a non-UUID command identifier', () => {
    const result = gameCommandMessageSchema.safeParse({
      command: { type: 'StartGame' },
      commandId: 'command-1',
      expectedVersion: 2,
      gameId: GAME_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe('game HTTP request contracts', () => {
  test('accepts create with only a command UUID', () => {
    const result = createGameRequestSchema.safeParse({
      commandId: COMMAND_ID,
    });

    expect(result.success).toBe(true);
  });

  test('rejects client-controlled identity during create', () => {
    const result = createGameRequestSchema.safeParse({
      commandId: COMMAND_ID,
      userId: '10000000-0000-4000-8000-000000000001',
    });

    expect(result.success).toBe(false);
  });

  test('validates join version and position boundaries', () => {
    const result = joinGameRequestSchema.safeParse({
      commandId: COMMAND_ID,
      expectedVersion: -1,
      seat: 0,
      team: 'white',
    });

    expect(result.success).toBe(false);
  });

  test('accepts a versioned waiting game departure request', () => {
    const result = leaveGameRequestSchema.safeParse({
      commandId: COMMAND_ID,
      expectedVersion: 2,
    });

    expect(result.success).toBe(true);
  });

  test('accepts a closed or left game response', () => {
    const result = leaveGameResponseSchema.safeParse({ gameId: GAME_ID });

    expect(result.success).toBe(true);
  });

  test('coerces the event sequence from an HTTP query', () => {
    const result = gameEventsQuerySchema.safeParse({ afterSequence: '2' });

    expect(result).toMatchObject({
      data: { afterSequence: 2 },
      success: true,
    });
  });
});

describe('lobby games response contract', () => {
  test('accepts unfinished games with public player positions', () => {
    const result = lobbyGamesResponseSchema.safeParse({
      currentPlayerGameId: null,
      items: [
        {
          createdAt: '2026-08-28T10:00:00.000Z',
          id: GAME_ID,
          players: [
            {
              avatarVersion: null,
              displayName: 'Ada',
              id: '10000000-0000-4000-8000-000000000001',
              seat: 1,
              team: 'white',
            },
          ],
          startedAt: null,
          status: 'waiting',
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  test('rejects finished games from the active lobby', () => {
    const result = lobbyGamesResponseSchema.safeParse({
      currentPlayerGameId: null,
      items: [
        {
          createdAt: '2026-08-28T10:00:00.000Z',
          id: GAME_ID,
          players: [],
          startedAt: '2026-08-28T10:01:00.000Z',
          status: 'finished',
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});

describe('lobby Socket.IO contract', () => {
  test('accepts an update with a game UUID', () => {
    const result = lobbyUpdatedMessageSchema.safeParse({ gameId: GAME_ID });

    expect(result.success).toBe(true);
  });

  test('rejects an update with an invalid game identifier', () => {
    const result = lobbyUpdatedMessageSchema.safeParse({ gameId: 'game-1' });

    expect(result.success).toBe(false);
  });
});
