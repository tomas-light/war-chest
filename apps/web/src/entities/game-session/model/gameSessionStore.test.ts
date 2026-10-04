import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import {
  type GameViewEventData,
  GAME_EVENT_VERSION,
  GAME_RULES_VERSION,
} from '@war-chest/game-engine';
import { describe, expect, test } from 'vitest';
import { createGameSessionStore } from './gameSessionStore';
import { restoreHistoricalView } from './restoreHistoricalView';

describe('game session event synchronization', () => {
  test('preserves the selected history through incoming events and resynchronization', () => {
    const events: GameViewEventData[] = [
      {
        payload: {
          creatorId: 'creator-1',
          featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
          rulesVersion: GAME_RULES_VERSION,
          settings: {
            cardSelectionMode: 'random',
            expansions: [],
            format: 'duel',
          },
        },
        sequence: 1,
        type: 'GameCreated',
        version: GAME_EVENT_VERSION,
      },
      {
        payload: { playerId: 'player-1', seat: 1, team: 'white' },
        sequence: 2,
        type: 'PlayerJoined',
        version: GAME_EVENT_VERSION,
      },
      {
        payload: { playerId: 'player-2', seat: 1, team: 'black' },
        sequence: 3,
        type: 'PlayerJoined',
        version: GAME_EVENT_VERSION,
      },
    ];
    const store = createGameSessionStore();
    const historical = restoreHistoricalView(events, 1);
    store.getState().hydrate(restoreHistoricalView(events, 2));
    store.getState().viewHistoricalState(historical);

    store.getState().applyEvents(events.slice(2));
    expect(store.getState().viewedState).toBe(historical);
    const snapshot = restoreHistoricalView(events, 3);
    store.getState().hydrate(snapshot);

    expect(store.getState().viewedState?.players).toEqual([]);
    expect(store.getState().liveState?.players).toHaveLength(2);
    store.getState().viewLiveState();
    expect(store.getState().viewedState).toBe(snapshot);
  });

  test('applies the event immediately following the live snapshot', () => {
    const store = createGameSessionStore();

    store.getState().hydrate({
      battlefield: null,
      cardSelection: null,
      creatorId: 'creator-1',
      currentPlayerId: null,
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
      firstPlayerId: null,
      initiativePlayerId: null,
      lastEventSequence: 1,
      moveCount: 0,
      players: [],
      privateMoves: [],
      rulesVersion: GAME_RULES_VERSION,
      settings: {
        cardSelectionMode: 'random',
        expansions: [],
        format: 'duel',
      },
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
      battlefield: null,
      cardSelection: null,
      creatorId: 'creator-1',
      currentPlayerId: null,
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
      firstPlayerId: null,
      initiativePlayerId: null,
      lastEventSequence: 1,
      moveCount: 0,
      players: [],
      privateMoves: [],
      rulesVersion: GAME_RULES_VERSION,
      settings: {
        cardSelectionMode: 'random',
        expansions: [],
        format: 'duel',
      },
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
