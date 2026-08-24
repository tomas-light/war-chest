import { describe, expect, test } from 'vitest';
import {
  type GameEventData,
  GAME_EVENT_VERSION,
  GAME_RULES_VERSION,
  parseGameEventData,
} from '../src/index.js';

const SUPPORTED_EVENTS: readonly GameEventData[] = [
  {
    payload: {
      featureFlags: { gameHistory: true, spectatorMode: false },
      rulesVersion: GAME_RULES_VERSION,
    },
    sequence: 1,
    type: 'GameCreated',
    version: GAME_EVENT_VERSION,
  },
  {
    payload: { playerId: 'player-one', seat: 1, team: 'white' },
    sequence: 2,
    type: 'PlayerJoined',
    version: GAME_EVENT_VERSION,
  },
  {
    payload: {
      playerId: 'player-one',
      reconnectDeadline: '2026-08-16T12:15:00.000Z',
    },
    sequence: 3,
    type: 'PlayerDisconnected',
    version: GAME_EVENT_VERSION,
  },
  {
    payload: { playerId: 'player-one' },
    sequence: 4,
    type: 'PlayerReconnected',
    version: GAME_EVENT_VERSION,
  },
  {
    payload: { playerId: 'player-one', reason: 'disconnectTimeout' },
    sequence: 5,
    type: 'PlayerDefeated',
    version: GAME_EVENT_VERSION,
  },
  {
    payload: { firstPlayerId: 'player-one' },
    sequence: 6,
    type: 'GameStarted',
    version: GAME_EVENT_VERSION,
  },
  {
    payload: {
      moveNumber: 1,
      nextPlayerId: 'player-two',
      playerId: 'player-one',
      privateData: { cards: [1, 'two', true, null] },
    },
    sequence: 7,
    type: 'TestMovePerformed',
    version: GAME_EVENT_VERSION,
  },
  {
    payload: { winnerTeam: 'white' },
    sequence: 8,
    type: 'GameFinished',
    version: GAME_EVENT_VERSION,
  },
];

describe('parseGameEventData', () => {
  test.each(SUPPORTED_EVENTS)('accepts $type', (event) => {
    expect(parseGameEventData(event)).toEqual(event);
  });

  test('rejects an unknown event type', () => {
    expect(() =>
      parseGameEventData({
        payload: {},
        sequence: 1,
        type: 'UnknownEvent',
        version: GAME_EVENT_VERSION,
      })
    ).toThrow();
  });

  test('rejects an unsupported event version', () => {
    expect(() =>
      parseGameEventData({
        payload: { firstPlayerId: 'player-one' },
        sequence: 1,
        type: 'GameStarted',
        version: GAME_EVENT_VERSION + 1,
      })
    ).toThrow();
  });

  test('rejects invalid event metadata', () => {
    expect(() =>
      parseGameEventData({
        payload: { firstPlayerId: 'player-one' },
        sequence: 0,
        type: 'GameStarted',
        version: GAME_EVENT_VERSION,
      })
    ).toThrow();
  });

  test('rejects a malformed event payload', () => {
    expect(() =>
      parseGameEventData({
        payload: { firstPlayerId: 42 },
        sequence: 1,
        type: 'GameStarted',
        version: GAME_EVENT_VERSION,
      })
    ).toThrow();
  });

  test('rejects a non-ISO reconnect deadline', () => {
    expect(() =>
      parseGameEventData({
        payload: {
          playerId: 'player-one',
          reconnectDeadline: 'tomorrow',
        },
        sequence: 1,
        type: 'PlayerDisconnected',
        version: GAME_EVENT_VERSION,
      })
    ).toThrow();
  });

  test('rejects a non-boolean feature flag', () => {
    expect(() =>
      parseGameEventData({
        payload: {
          featureFlags: { spectatorMode: 'enabled' },
          rulesVersion: GAME_RULES_VERSION,
        },
        sequence: 1,
        type: 'GameCreated',
        version: GAME_EVENT_VERSION,
      })
    ).toThrow();
  });

  test('rejects non-JSON private data', () => {
    expect(() =>
      parseGameEventData({
        payload: {
          moveNumber: 1,
          nextPlayerId: 'player-two',
          playerId: 'player-one',
          privateData: undefined,
        },
        sequence: 1,
        type: 'TestMovePerformed',
        version: GAME_EVENT_VERSION,
      })
    ).toThrow();
  });
});
