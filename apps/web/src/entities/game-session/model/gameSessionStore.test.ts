import { GAME_EVENT_VERSION, GAME_RULES_VERSION } from '@war-chest/game-engine';
import { describe, expect, test } from 'vitest';
import { createGameSessionStore } from './gameSessionStore';

describe('game session event synchronization', () => {
  test('applies the event immediately following the live snapshot', () => {
    const store = createGameSessionStore();

    store.getState().hydrate({
      currentPlayerId: null,
      featureFlags: {},
      lastEventSequence: 1,
      moveCount: 0,
      players: [],
      privateMoves: [],
      rulesVersion: GAME_RULES_VERSION,
      status: 'waiting',
      teams: { black: [], white: [] },
      winnerTeam: null,
    });
    store.getState().applyEvents([
      {
        payload: { playerId: 'player-1', seat: 1, team: 'white' },
        sequence: 2,
        type: 'PlayerJoined',
        version: GAME_EVENT_VERSION,
      },
    ]);

    expect(store.getState().liveState?.lastEventSequence).toBe(2);
  });

  test('marks the session as desynchronized when an event is missing', () => {
    const store = createGameSessionStore();

    store.getState().hydrate({
      currentPlayerId: null,
      featureFlags: {},
      lastEventSequence: 1,
      moveCount: 0,
      players: [],
      privateMoves: [],
      rulesVersion: GAME_RULES_VERSION,
      status: 'waiting',
      teams: { black: [], white: [] },
      winnerTeam: null,
    });
    store.getState().applyEvents([
      {
        payload: { playerId: 'player-1', seat: 1, team: 'white' },
        sequence: 3,
        type: 'PlayerJoined',
        version: GAME_EVENT_VERSION,
      },
    ]);

    expect(store.getState().synchronizationStatus).toBe('desynchronized');
  });
});
