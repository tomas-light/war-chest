import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { GAME_EVENT_VERSION, GAME_RULES_VERSION } from '@war-chest/game-engine';
import { describe, expect, test } from 'vitest';
import { createGameSessionStore } from './gameSessionStore';

describe('game session event synchronization', () => {
  test('applies the event immediately following the live snapshot', () => {
    const store = createGameSessionStore();

    store.getState().hydrate({
      creatorId: 'creator-1',
      currentPlayerId: null,
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
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
      creatorId: 'creator-1',
      currentPlayerId: null,
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
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

  test('retains public player profiles for the open game session', () => {
    const store = createGameSessionStore();

    store.getState().retainPlayerProfiles([
      {
        avatarVersion: 'avatar-1',
        displayName: 'Player One',
        id: 'player-1',
        seat: 1,
        team: 'white',
      },
    ]);

    expect(store.getState().playerProfiles).toEqual([
      {
        avatarVersion: 'avatar-1',
        displayName: 'Player One',
        id: 'player-1',
        seat: 1,
        team: 'white',
      },
    ]);
  });
});
