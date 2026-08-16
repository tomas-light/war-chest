import { beforeEach, describe, expect, test } from 'vitest';
import {
  type GameEventData,
  type GameState,
  applyEvent,
  applyViewEvent,
  createGame,
  createViewEventFor,
  createViewFor,
  decide,
  decidePresence,
} from '../src/index.js';

const FIRST_PLAYER_ID = 'player-one';
const SECOND_PLAYER_ID = 'player-two';
const RECONNECT_DEADLINE = '2026-08-16T12:15:00.000Z';

describe('player presence', () => {
  let events: GameEventData[];
  let state: GameState;

  beforeEach(() => {
    const gameCreated = createGame({ featureFlags: {}, type: 'CreateGame' });
    events = [gameCreated];
    state = applyEvent(null, gameCreated);

    const commands = [
      [FIRST_PLAYER_ID, { seat: 1, team: 'white', type: 'JoinGame' } as const],
      [SECOND_PLAYER_ID, { seat: 1, team: 'black', type: 'JoinGame' } as const],
      [FIRST_PLAYER_ID, { type: 'StartGame' } as const],
    ] as const;

    for (const [playerId, command] of commands) {
      const decidedEvents = decide(state, playerId, command);
      events.push(...decidedEvents);
      state = decidedEvents.reduce(applyEvent, state);
    }
  });

  test('records an exact reconnect deadline for a disconnected player', () => {
    const [event] = decidePresence(state, {
      playerId: FIRST_PLAYER_ID,
      reconnectDeadline: RECONNECT_DEADLINE,
      type: 'DisconnectPlayer',
    });

    expect(event).toEqual({
      payload: {
        playerId: FIRST_PLAYER_ID,
        reconnectDeadline: RECONNECT_DEADLINE,
      },
      sequence: 5,
      type: 'PlayerDisconnected',
      version: 1,
    });
  });

  test('restores connected presence when the player returns in time', () => {
    const disconnectedEvents = decidePresence(state, {
      playerId: FIRST_PLAYER_ID,
      reconnectDeadline: RECONNECT_DEADLINE,
      type: 'DisconnectPlayer',
    });
    state = disconnectedEvents.reduce(applyEvent, state);

    const reconnectedEvents = decidePresence(state, {
      playerId: FIRST_PLAYER_ID,
      reconnectedAt: '2026-08-16T12:14:59.000Z',
      type: 'ReconnectPlayer',
    });
    state = reconnectedEvents.reduce(applyEvent, state);

    expect(
      state.players.find((player) => player.id === FIRST_PLAYER_ID)
    ).toMatchObject({
      presence: 'connected',
      reconnectDeadline: null,
    });
  });

  test('rejects reconnect after the stored deadline', () => {
    const disconnectedEvents = decidePresence(state, {
      playerId: FIRST_PLAYER_ID,
      reconnectDeadline: RECONNECT_DEADLINE,
      type: 'DisconnectPlayer',
    });
    state = disconnectedEvents.reduce(applyEvent, state);

    const eventsAfterDeadline = decidePresence(state, {
      playerId: FIRST_PLAYER_ID,
      reconnectedAt: '2026-08-16T12:15:00.001Z',
      type: 'ReconnectPlayer',
    });

    expect(eventsAfterDeadline).toEqual([]);
  });

  test('finishes the game when a disconnected player times out', () => {
    const disconnectedEvents = decidePresence(state, {
      playerId: FIRST_PLAYER_ID,
      reconnectDeadline: RECONNECT_DEADLINE,
      type: 'DisconnectPlayer',
    });
    state = disconnectedEvents.reduce(applyEvent, state);

    const defeatedEvents = decidePresence(state, {
      defeatedAt: RECONNECT_DEADLINE,
      playerId: FIRST_PLAYER_ID,
      reconnectDeadline: RECONNECT_DEADLINE,
      type: 'DefeatDisconnectedPlayer',
    });
    state = defeatedEvents.reduce(applyEvent, state);

    expect(defeatedEvents.map((event) => event.type)).toEqual([
      'PlayerDefeated',
      'GameFinished',
    ]);
    expect(state).toMatchObject({ status: 'finished', winnerTeam: 'black' });
  });

  test('ignores a stale deadline after the player reconnected', () => {
    const disconnectedEvents = decidePresence(state, {
      playerId: FIRST_PLAYER_ID,
      reconnectDeadline: RECONNECT_DEADLINE,
      type: 'DisconnectPlayer',
    });
    state = disconnectedEvents.reduce(applyEvent, state);
    const reconnectedEvents = decidePresence(state, {
      playerId: FIRST_PLAYER_ID,
      reconnectedAt: '2026-08-16T12:14:00.000Z',
      type: 'ReconnectPlayer',
    });
    state = reconnectedEvents.reduce(applyEvent, state);

    const staleDeadlineEvents = decidePresence(state, {
      defeatedAt: RECONNECT_DEADLINE,
      playerId: FIRST_PLAYER_ID,
      reconnectDeadline: RECONNECT_DEADLINE,
      type: 'DefeatDisconnectedPlayer',
    });

    expect(staleDeadlineEvents).toEqual([]);
  });

  test('exposes presence changes in safe view events', () => {
    const [event] = decidePresence(state, {
      playerId: FIRST_PLAYER_ID,
      reconnectDeadline: RECONNECT_DEADLINE,
      type: 'DisconnectPlayer',
    });

    if (event === undefined) {
      throw new Error('Expected a presence event.');
    }

    const viewEvent = createViewEventFor(event, { role: 'spectator' });
    const view = createViewFor(state, { role: 'spectator' });
    const nextView = applyViewEvent(view, viewEvent);

    expect(viewEvent).toMatchObject({
      payload: { reconnectDeadline: RECONNECT_DEADLINE },
      type: 'PlayerDisconnected',
    });
    expect(
      nextView.players.find((player) => player.id === FIRST_PLAYER_ID)
    ).toMatchObject({
      presence: 'disconnected',
      reconnectDeadline: RECONNECT_DEADLINE,
    });
  });
});
