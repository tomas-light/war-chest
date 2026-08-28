import {
  type RuntimeFeatureFlags,
  DEFAULT_RUNTIME_FEATURE_FLAGS,
} from '@war-chest/feature-flags';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  type GameCommandData,
  type GameEventData,
  type GameState,
  type GameViewEventData,
  type Viewer,
  applyEvent,
  applyViewEvent,
  createGame,
  createViewEventFor,
  createViewFor,
  decide,
  GAME_EVENT_VERSION,
  hydrateCommand,
  hydrateEvent,
  hydrateViewEvent,
  NullableGameStateError,
  NullableGameViewError,
  restoreGame,
  restoreView,
} from '../src/index.js';

describe('game creation', () => {
  test('returns null when restoring an empty game history', () => {
    expect(restoreGame([])).toBeNull();
  });

  test('returns null when restoring an empty view history', () => {
    expect(restoreView([])).toBeNull();
  });

  test('creates the first persisted event without a game state', () => {
    const featureFlags: RuntimeFeatureFlags = {
      ...DEFAULT_RUNTIME_FEATURE_FLAGS,
    };
    const event = createGame({ featureFlags, type: 'CreateGame' });

    expect(event).toEqual({
      payload: {
        featureFlags,
        rulesVersion: 1,
      },
      sequence: 1,
      type: 'GameCreated',
      version: GAME_EVENT_VERSION,
    });
  });

  test('creates a waiting state from the first event', () => {
    const featureFlags: RuntimeFeatureFlags = {
      ...DEFAULT_RUNTIME_FEATURE_FLAGS,
    };
    const event = createGame({ featureFlags, type: 'CreateGame' });

    expect(applyEvent(null, event)).toMatchObject({
      featureFlags,
      lastEventSequence: 1,
      status: 'waiting',
    });
  });

  test('creates empty team arrays from the first event', () => {
    const event = createGame({
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
      type: 'CreateGame',
    });

    expect(applyEvent(null, event).teams).toEqual({
      black: [],
      white: [],
    });
  });
});

describe('technical scenario', () => {
  let commands: readonly [string, GameCommandData][];
  let events: GameEventData[];
  let state: GameState;

  beforeEach(() => {
    const gameCreatedEvent = createGame({
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
      type: 'CreateGame',
    });
    commands = [
      ['player-one', { seat: 1, team: 'white', type: 'JoinGame' }],
      ['player-two', { seat: 1, team: 'black', type: 'JoinGame' }],
      ['player-one', { type: 'StartGame' }],
      ['player-one', { privateData: { card: 'hidden-one' }, type: 'TestMove' }],
      ['player-two', { privateData: { card: 'hidden-two' }, type: 'TestMove' }],
      ['player-one', { type: 'FinishGame' }],
    ];

    events = [gameCreatedEvent];
    state = applyEvent(null, gameCreatedEvent);

    for (const [playerId, command] of commands) {
      const decidedEvents = decide(state, playerId, command);
      events.push(...decidedEvents);
      state = decidedEvents.reduce(applyEvent, state);
    }
  });

  test('emits one event for every accepted command', () => {
    expect(events.map((event) => event.type)).toEqual([
      'GameCreated',
      'PlayerJoined',
      'PlayerJoined',
      'GameStarted',
      'TestMovePerformed',
      'TestMovePerformed',
      'GameFinished',
    ]);
  });

  test('assigns consecutive sequence numbers', () => {
    expect(events.map((event) => event.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });

  test('uses the current schema version for every event', () => {
    expect(events.every((event) => event.version === GAME_EVENT_VERSION)).toBe(
      true
    );
  });

  test('round-trips every command through runtime hydration', () => {
    const commandData = commands.map(([, data]) => data);
    const hydratedCommands = commandData.map((data) => hydrateCommand(data));

    expect(hydratedCommands.map((command) => command.toData())).toEqual(
      commandData
    );
  });

  test('does not retain caller-owned command data objects', () => {
    const commandData = commands.map(([, data]) => data);
    const hydratedCommands = commandData.map((data) => hydrateCommand(data));

    expect(
      hydratedCommands.every(
        (command, index) => command.data !== commandData[index]
      )
    ).toBe(true);
  });

  test('returns new data objects when serializing runtime commands', () => {
    const hydratedCommands = commands.map(([, data]) => hydrateCommand(data));

    expect(
      hydratedCommands.every((command) => command.toData() !== command.data)
    ).toBe(true);
  });

  test('round-trips every event through runtime hydration', () => {
    const hydratedEvents = events.map((eventData) => hydrateEvent(eventData));

    expect(hydratedEvents.map((event) => event.toData())).toEqual(events);
  });

  test('does not retain caller-owned event data objects', () => {
    const hydratedEvents = events.map((eventData) => hydrateEvent(eventData));

    expect(
      hydratedEvents.every((event, index) => event.data !== events[index])
    ).toBe(true);
  });

  test('returns new data objects when serializing runtime events', () => {
    const hydratedEvents = events.map((eventData) => hydrateEvent(eventData));

    expect(hydratedEvents.every((event) => event.toData() !== event.data)).toBe(
      true
    );
  });

  test('produces the expected final game status and counters', () => {
    expect(state).toMatchObject({
      currentPlayerId: null,
      featureFlags: { gameHistory: true },
      lastEventSequence: 7,
      moveCount: 2,
      status: 'finished',
    });
  });

  test('retains the teams selected before the game starts', () => {
    expect(state.teams).toEqual({
      black: ['player-two'],
      white: ['player-one'],
    });
  });

  test('records the current player team as the winner', () => {
    expect(state.winnerTeam).toBe('white');
  });

  test('stores each player private move history', () => {
    expect(state.players).toEqual([
      {
        id: 'player-one',
        moveCount: 1,
        presence: 'connected',
        privateMoves: [{ data: { card: 'hidden-one' }, moveNumber: 1 }],
        reconnectDeadline: null,
        seat: 1,
        team: 'white',
      },
      {
        id: 'player-two',
        moveCount: 1,
        presence: 'connected',
        privateMoves: [{ data: { card: 'hidden-two' }, moveNumber: 2 }],
        reconnectDeadline: null,
        seat: 1,
        team: 'black',
      },
    ]);
  });

  test('restores the same game state from persisted events', () => {
    expect(restoreGame(events)).toEqual(state);
  });
});

describe('commands rejected while waiting', () => {
  let waitingState: GameState;

  beforeEach(() => {
    const gameCreated = createGame({
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
      type: 'CreateGame',
    });
    waitingState = applyEvent(null, gameCreated);
    const playerJoined = decide(waitingState, 'player-one', {
      seat: 1,
      team: 'white',
      type: 'JoinGame',
    });
    waitingState = playerJoined.reduce(applyEvent, waitingState);
  });

  test('rejects a duplicate player', () => {
    expect(
      decide(waitingState, 'player-one', {
        seat: 1,
        team: 'black',
        type: 'JoinGame',
      })
    ).toEqual([]);
  });

  test('rejects start before the second player joins', () => {
    expect(decide(waitingState, 'player-one', { type: 'StartGame' })).toEqual(
      []
    );
  });

  test('rejects start from a player who has not joined', () => {
    const secondPlayerJoined = decide(waitingState, 'player-two', {
      seat: 1,
      team: 'black',
      type: 'JoinGame',
    });
    const fullWaitingState = secondPlayerJoined.reduce(
      applyEvent,
      waitingState
    );

    expect(
      decide(fullWaitingState, 'player-three', { type: 'StartGame' })
    ).toEqual([]);
  });

  test('rejects a move before the game starts', () => {
    expect(decide(waitingState, 'player-one', { type: 'TestMove' })).toEqual(
      []
    );
  });

  test('does not mutate state after rejecting a command', () => {
    const stateBeforeRejectedCommand: GameState = structuredClone(waitingState);

    decide(waitingState, 'player-one', { type: 'TestMove' });

    expect(waitingState).toEqual(stateBeforeRejectedCommand);
  });
});

describe('explicit player seat selection', () => {
  let waitingState: GameState;

  beforeEach(() => {
    const gameCreated = createGame({
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
      type: 'CreateGame',
    });
    waitingState = applyEvent(null, gameCreated);
  });

  test('joins the player at the seat selected by the client', () => {
    const [playerJoined] = decide(waitingState, 'player-one', {
      seat: 1,
      team: 'black',
      type: 'JoinGame',
    });

    expect(playerJoined).toMatchObject({
      payload: { playerId: 'player-one', seat: 1, team: 'black' },
      type: 'PlayerJoined',
    });
  });

  test('adds the player to the selected team before the game starts', () => {
    const playerJoined = decide(waitingState, 'player-one', {
      seat: 1,
      team: 'black',
      type: 'JoinGame',
    });

    expect(playerJoined.reduce(applyEvent, waitingState).teams).toEqual({
      black: ['player-one'],
      white: [],
    });
  });

  test('rejects a seat that is not available in the current rules', () => {
    expect(
      decide(waitingState, 'player-one', {
        seat: 2,
        team: 'white',
        type: 'JoinGame',
      })
    ).toEqual([]);
  });

  test('rejects a seat already occupied by another player', () => {
    const playerJoined = decide(waitingState, 'player-one', {
      seat: 1,
      team: 'white',
      type: 'JoinGame',
    });
    waitingState = playerJoined.reduce(applyEvent, waitingState);

    expect(
      decide(waitingState, 'player-two', {
        seat: 1,
        team: 'white',
        type: 'JoinGame',
      })
    ).toEqual([]);
  });

  test('allows the same seat number in the opposing team', () => {
    const playerJoined = decide(waitingState, 'player-one', {
      seat: 1,
      team: 'white',
      type: 'JoinGame',
    });
    waitingState = playerJoined.reduce(applyEvent, waitingState);

    expect(
      decide(waitingState, 'player-two', {
        seat: 1,
        team: 'black',
        type: 'JoinGame',
      })
    ).toHaveLength(1);
  });
});

describe('team formation from selected positions', () => {
  let activeState: GameState;

  beforeEach(() => {
    const gameCreated = createGame({
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
      type: 'CreateGame',
    });
    const commands: readonly [string, GameCommandData][] = [
      ['player-one', { seat: 1, team: 'black', type: 'JoinGame' }],
      ['player-two', { seat: 1, team: 'white', type: 'JoinGame' }],
      ['player-one', { type: 'StartGame' }],
    ];

    activeState = applyEvent(null, gameCreated);

    for (const [playerId, command] of commands) {
      activeState = decide(activeState, playerId, command).reduce(
        applyEvent,
        activeState
      );
    }
  });

  test('starts with the player who selected the first seat', () => {
    expect(activeState.currentPlayerId).toBe('player-two');
  });

  test('assigns teams from selected positions rather than join order', () => {
    expect(activeState.teams).toEqual({
      black: ['player-one'],
      white: ['player-two'],
    });
  });
});

describe('commands rejected while active', () => {
  let activeState: GameState;

  beforeEach(() => {
    const gameCreated = createGame({
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
      type: 'CreateGame',
    });
    const commands: readonly [string, GameCommandData][] = [
      ['player-one', { seat: 1, team: 'white', type: 'JoinGame' }],
      ['player-two', { seat: 1, team: 'black', type: 'JoinGame' }],
      ['player-two', { type: 'StartGame' }],
    ];

    activeState = applyEvent(null, gameCreated);

    for (const [playerId, command] of commands) {
      activeState = decide(activeState, playerId, command).reduce(
        applyEvent,
        activeState
      );
    }
  });

  test('rejects a move from the player without the current turn', () => {
    expect(decide(activeState, 'player-two', { type: 'TestMove' })).toEqual([]);
  });

  test('rejects finish from the player without the current turn', () => {
    expect(decide(activeState, 'player-two', { type: 'FinishGame' })).toEqual(
      []
    );
  });

  test('rejects a new player after the game starts', () => {
    expect(
      decide(activeState, 'third-player', {
        seat: 1,
        team: 'white',
        type: 'JoinGame',
      })
    ).toEqual([]);
  });
});

describe('safe player and spectator views', () => {
  let state: GameState;
  let firstPlayerViewer: Viewer;
  let secondPlayerViewer: Viewer;
  let spectator: Viewer;
  let firstPlayerViewEvents: GameViewEventData[];
  let secondPlayerViewEvents: GameViewEventData[];
  let spectatorViewEvents: GameViewEventData[];

  beforeEach(() => {
    const gameCreated = createGame({
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
      type: 'CreateGame',
    });
    const commands: readonly [string, GameCommandData][] = [
      ['player-one', { seat: 1, team: 'white', type: 'JoinGame' }],
      ['player-two', { seat: 1, team: 'black', type: 'JoinGame' }],
      ['player-one', { type: 'StartGame' }],
      ['player-one', { privateData: 'hidden-one', type: 'TestMove' }],
      ['player-two', { privateData: 'hidden-two', type: 'TestMove' }],
      ['player-one', { type: 'FinishGame' }],
    ];
    const events: GameEventData[] = [gameCreated];

    state = applyEvent(null, gameCreated);

    for (const [playerId, command] of commands) {
      const decidedEvents = decide(state, playerId, command);
      events.push(...decidedEvents);
      state = decidedEvents.reduce(applyEvent, state);
    }

    firstPlayerViewer = { playerId: 'player-one', role: 'player' };
    secondPlayerViewer = { playerId: 'player-two', role: 'player' };
    spectator = { role: 'spectator' };

    firstPlayerViewEvents = events.map((event) =>
      createViewEventFor(event, firstPlayerViewer)
    );
    secondPlayerViewEvents = events.map((event) =>
      createViewEventFor(event, secondPlayerViewer)
    );
    spectatorViewEvents = events.map((event) =>
      createViewEventFor(event, spectator)
    );
  });

  test('round-trips safe events through view hydration', () => {
    const hydratedEvents = firstPlayerViewEvents.map((eventData) =>
      hydrateViewEvent(eventData)
    );

    expect(hydratedEvents.map((event) => event.toData())).toEqual(
      firstPlayerViewEvents
    );
  });

  test('does not retain caller-owned view event data objects', () => {
    const hydratedEvents = firstPlayerViewEvents.map((eventData) =>
      hydrateViewEvent(eventData)
    );

    expect(
      hydratedEvents.every(
        (event, index) => event.data !== firstPlayerViewEvents[index]
      )
    ).toBe(true);
  });

  test('returns new data objects when serializing runtime view events', () => {
    const hydratedEvents = firstPlayerViewEvents.map((eventData) =>
      hydrateViewEvent(eventData)
    );

    expect(hydratedEvents.every((event) => event.toData() !== event.data)).toBe(
      true
    );
  });

  test('restores the first player view from safe events', () => {
    expect(restoreView(firstPlayerViewEvents)).toEqual(
      createViewFor(state, firstPlayerViewer)
    );
  });

  test('restores the second player view from safe events', () => {
    expect(restoreView(secondPlayerViewEvents)).toEqual(
      createViewFor(state, secondPlayerViewer)
    );
  });

  test('restores the spectator view from safe events', () => {
    expect(restoreView(spectatorViewEvents)).toEqual(
      createViewFor(state, spectator)
    );
  });

  test('does not send the second player private data to the first player', () => {
    expect(JSON.stringify(firstPlayerViewEvents)).not.toContain('hidden-two');
  });

  test('does not send the first player private data to the second player', () => {
    expect(JSON.stringify(secondPlayerViewEvents)).not.toContain('hidden-one');
  });

  test('does not send private data to the spectator', () => {
    expect(JSON.stringify(spectatorViewEvents)).not.toContain('hidden-');
  });

  test('does not include private move history in the spectator snapshot', () => {
    expect(createViewFor(state, spectator).privateMoves).toEqual([]);
  });
});

test('advances a created view for a fully hidden event', () => {
  const gameCreated = createGame({
    featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
    type: 'CreateGame',
  });
  const spectator: Viewer = { role: 'spectator' };
  const gameCreatedViewEvent = createViewEventFor(gameCreated, spectator);
  const view = applyViewEvent(null, gameCreatedViewEvent);
  const event: GameViewEventData = {
    sequence: 2,
    type: 'ViewSequenceAdvanced',
    version: GAME_EVENT_VERSION,
  };

  expect(applyViewEvent(view, event)).toEqual({
    ...view,
    lastEventSequence: 2,
  });
});

describe('history beginning with an invalid event', () => {
  test('throws NullableGameStateError for an internal history', () => {
    const playerJoined: GameEventData = {
      payload: { playerId: 'player-one', seat: 1, team: 'white' },
      sequence: 1,
      type: 'PlayerJoined',
      version: GAME_EVENT_VERSION,
    };

    expect(() => restoreGame([playerJoined])).toThrow(NullableGameStateError);
  });

  test('explains the required first internal event', () => {
    const playerJoined: GameEventData = {
      payload: { playerId: 'player-one', seat: 1, team: 'white' },
      sequence: 1,
      type: 'PlayerJoined',
      version: GAME_EVENT_VERSION,
    };

    expect(() => restoreGame([playerJoined])).toThrow(
      'GameCreated must be the first event in the game history'
    );
  });

  test('throws NullableGameViewError for a safe history', () => {
    const viewSequenceAdvanced: GameViewEventData = {
      sequence: 1,
      type: 'ViewSequenceAdvanced',
      version: GAME_EVENT_VERSION,
    };

    expect(() => restoreView([viewSequenceAdvanced])).toThrow(
      NullableGameViewError
    );
  });

  test('explains the required first safe event', () => {
    const viewSequenceAdvanced: GameViewEventData = {
      sequence: 1,
      type: 'ViewSequenceAdvanced',
      version: GAME_EVENT_VERSION,
    };

    expect(() => restoreView([viewSequenceAdvanced])).toThrow(
      'GameCreated must be the first event in the view history'
    );
  });
});

describe('repeated GameCreated event', () => {
  test('rejects a repeated internal event', () => {
    const gameCreated = createGame({
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
      type: 'CreateGame',
    });

    expect(() => restoreGame([gameCreated, gameCreated])).toThrow(
      'GameCreated cannot be applied to an existing game'
    );
  });

  test('rejects a repeated safe event', () => {
    const gameCreated = createGame({
      featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
      type: 'CreateGame',
    });
    const spectator: Viewer = { role: 'spectator' };
    const gameCreatedViewEvent = createViewEventFor(gameCreated, spectator);

    expect(() =>
      restoreView([gameCreatedViewEvent, gameCreatedViewEvent])
    ).toThrow('GameCreated cannot be applied to an existing game view');
  });
});
