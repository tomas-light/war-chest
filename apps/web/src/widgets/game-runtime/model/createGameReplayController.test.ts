import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import {
  type GameCreatedViewEventData,
  type GameViewEventData,
  GAME_EVENT_VERSION,
  GAME_RULES_VERSION,
} from '@war-chest/game-engine';
import { describe, expect, test, vi } from 'vitest';
import {
  createGameSessionStore,
  restoreHistoricalView,
} from '#/entities/game-session';
import { createGameReplayController } from './createGameReplayController';

const CREATED_EVENT: GameCreatedViewEventData = {
  payload: {
    creatorId: 'player-one',
    featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
    rulesVersion: GAME_RULES_VERSION,
    settings: { cardSelectionMode: 'random', expansions: [], format: 'duel' },
  },
  sequence: 1,
  type: 'GameCreated',
  version: GAME_EVENT_VERSION,
};

describe('game history replay', () => {
  test('a late history response cannot override an immediate return to live', async () => {
    const events: GameViewEventData[] = [
      CREATED_EVENT,
      {
        payload: { playerId: 'player-two', seat: 1, team: 'black' },
        sequence: 2,
        type: 'PlayerJoined',
        version: GAME_EVENT_VERSION,
      },
    ];
    const store = createGameSessionStore();
    const live = restoreHistoricalView(events, 2);
    store.getState().hydrate(live);
    const pending = createDeferredEvents();
    const onStatusChange = vi.fn();
    const controller = createGameReplayController({
      gameSessionStore: store,
      loadEvents: () => pending.promise,
      onStatusChange,
    });

    const request = controller.viewHistory(1);
    controller.returnToLive();
    pending.resolve(events);
    await request;

    expect(store.getState().viewedState).toBe(live);
    expect(onStatusChange).toHaveBeenLastCalledWith('idle', null);
  });

  test('the last selected turn wins when history requests resolve out of order', async () => {
    const events: GameViewEventData[] = [
      CREATED_EVENT,
      {
        payload: { playerId: 'player-one', seat: 1, team: 'white' },
        sequence: 2,
        type: 'PlayerJoined',
        version: GAME_EVENT_VERSION,
      },
      {
        payload: { playerId: 'player-two', seat: 1, team: 'black' },
        sequence: 3,
        type: 'PlayerJoined',
        version: GAME_EVENT_VERSION,
      },
    ];
    const store = createGameSessionStore();
    store.getState().hydrate(restoreHistoricalView(events, 3));
    const first = createDeferredEvents();
    const second = createDeferredEvents();
    const loadEvents = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const controller = createGameReplayController({
      gameSessionStore: store,
      loadEvents,
      onStatusChange: vi.fn(),
    });

    const olderRequest = controller.viewHistory(1);
    const latestRequest = controller.viewHistory(2);
    second.resolve(events);
    await latestRequest;
    first.resolve(events);
    await olderRequest;

    expect(store.getState().viewedState?.players).toEqual([
      expect.objectContaining({ id: 'player-one' }),
    ]);
    expect(store.getState().viewedState?.lastEventSequence).toBe(2);
  });

  test('pause prevents a pending replay step from changing the viewed board', async () => {
    const events: GameViewEventData[] = [
      CREATED_EVENT,
      {
        payload: {
          controlPoints: [],
          playerResources: [],
          round: 1,
          units: [],
        },
        sequence: 2,
        type: 'BattlefieldPrepared',
        version: GAME_EVENT_VERSION,
      },
      {
        payload: {
          battlefield: {
            controlPoints: [],
            playerResources: [],
            round: 1,
            units: [],
          },
          coin: null,
          moveNumber: 1,
          nextPlayerId: 'player-two',
          playerId: 'player-one',
        },
        sequence: 3,
        type: 'TurnPassed',
        version: GAME_EVENT_VERSION,
      },
    ];
    const store = createGameSessionStore();
    store.getState().hydrate(restoreHistoricalView(events, 3));
    store.getState().viewHistoricalState(restoreHistoricalView(events, 2));
    const pending = createDeferredEvents();
    const onStatusChange = vi.fn();
    const controller = createGameReplayController({
      gameSessionStore: store,
      loadEvents: () => pending.promise,
      onStatusChange,
    });

    controller.playReplay();
    const step = controller.advanceReplay();
    controller.pauseReplay();
    pending.resolve(events);
    await step;

    expect(store.getState().viewedState?.moveCount).toBe(0);
    expect(onStatusChange).toHaveBeenLastCalledWith('paused', null);
  });

  test('replay skips presence events and catches up to the latest live state', async () => {
    const events: GameViewEventData[] = [
      CREATED_EVENT,
      {
        payload: {
          controlPoints: [],
          playerResources: [],
          round: 1,
          units: [],
        },
        sequence: 2,
        type: 'BattlefieldPrepared',
        version: GAME_EVENT_VERSION,
      },
      {
        payload: {
          playerId: 'player-one',
          reconnectDeadline: '2026-10-04T12:00:00.000Z',
        },
        sequence: 3,
        type: 'PlayerDisconnected',
        version: GAME_EVENT_VERSION,
      },
      {
        payload: {
          battlefield: {
            controlPoints: [],
            playerResources: [],
            round: 1,
            units: [],
          },
          coin: null,
          moveNumber: 1,
          nextPlayerId: 'player-two',
          playerId: 'player-one',
        },
        sequence: 4,
        type: 'TurnPassed',
        version: GAME_EVENT_VERSION,
      },
      {
        payload: {
          battlefield: {
            controlPoints: [],
            playerResources: [],
            round: 2,
            units: [],
          },
          coin: null,
          moveNumber: 2,
          nextPlayerId: 'player-one',
          playerId: 'player-two',
        },
        sequence: 5,
        type: 'TurnPassed',
        version: GAME_EVENT_VERSION,
      },
    ];
    const store = createGameSessionStore();
    store.getState().hydrate(restoreHistoricalView(events, 4));
    store.getState().viewHistoricalState(restoreHistoricalView(events, 2));
    const onStatusChange = vi.fn();
    const controller = createGameReplayController({
      gameSessionStore: store,
      loadEvents: () => Promise.resolve(events),
      onStatusChange,
    });

    store.getState().applyEvents(events.slice(4));
    controller.playReplay();
    await controller.advanceReplay();
    expect(store.getState().viewedState?.lastEventSequence).toBe(4);
    expect(onStatusChange).toHaveBeenLastCalledWith('playing', null);
    await controller.advanceReplay();

    expect(store.getState().viewedState).toBe(store.getState().liveState);
    expect(store.getState().viewedState?.battlefield?.round).toBe(2);
    expect(onStatusChange).toHaveBeenLastCalledWith('idle', null);
  });

  test('a failed replay request can resume after retry', async () => {
    const events: GameViewEventData[] = [
      CREATED_EVENT,
      {
        payload: {
          controlPoints: [],
          playerResources: [],
          round: 1,
          units: [],
        },
        sequence: 2,
        type: 'BattlefieldPrepared',
        version: GAME_EVENT_VERSION,
      },
      {
        payload: {
          battlefield: {
            controlPoints: [],
            playerResources: [],
            round: 1,
            units: [],
          },
          coin: null,
          moveNumber: 1,
          nextPlayerId: 'player-two',
          playerId: 'player-one',
        },
        sequence: 3,
        type: 'TurnPassed',
        version: GAME_EVENT_VERSION,
      },
    ];
    const store = createGameSessionStore();
    store.getState().hydrate(restoreHistoricalView(events, 3));
    store.getState().viewHistoricalState(restoreHistoricalView(events, 2));
    const error = new Error('Network unavailable');
    const onStatusChange = vi.fn();
    const controller = createGameReplayController({
      gameSessionStore: store,
      loadEvents: vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(events),
      onStatusChange,
    });

    await controller.advanceReplay();
    expect(onStatusChange).toHaveBeenLastCalledWith('error', error);
    controller.retryReplay();
    await controller.advanceReplay();

    expect(store.getState().viewedState).toBe(store.getState().liveState);
  });
});

function createDeferredEvents() {
  let resolveEvents: (events: readonly GameViewEventData[]) => void =
    unresolved;
  const promise = new Promise<readonly GameViewEventData[]>((resolve) => {
    resolveEvents = resolve;
  });

  return { promise, resolve: resolveEvents };

  function unresolved(): void {
    throw new Error('The deferred request has not been initialized.');
  }
}
