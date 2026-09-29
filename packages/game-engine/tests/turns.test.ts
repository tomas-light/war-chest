import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  type GameCommandData,
  type GameState,
  applyEvent,
  createGame,
  createViewEventFor,
  createViewFor,
  decide,
  getTurnActionOptions,
  parseGameEventData,
  previewTurnAction,
} from '../src/index.js';

describe('turn passing and round replenishment', () => {
  let state: GameState;

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    state = createActiveDuel();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('adds one Royal Coin to every starting bag', () => {
    expect(
      state.battlefield?.playerResources.map((resources) => [
        ...resources.bag,
        ...resources.hand,
      ])
    ).toEqual([
      expect.arrayContaining([{ kind: 'royal' }]),
      expect.arrayContaining([{ kind: 'royal' }]),
    ]);
    expect(
      state.battlefield?.playerResources.map(
        (resources) => resources.bag.length + resources.hand.length
      )
    ).toEqual([9, 9]);
  });

  test('discards the selected coin face down and advances the turn', () => {
    const currentPlayerId = state.currentPlayerId;
    const resources = state.battlefield?.playerResources.find(
      (item) => item.playerId === currentPlayerId
    );
    const selectedCoin = resources?.hand[1];
    const [event] = decide(state, currentPlayerId ?? '', {
      coinIndex: 1,
      type: 'PassTurn',
    });

    expect(event?.type).toBe('TurnPassed');

    if (event === undefined) {
      throw new Error('PassTurn must emit an event.');
    }

    const nextState = applyEvent(state, event);
    const nextResources = nextState.battlefield?.playerResources.find(
      (item) => item.playerId === currentPlayerId
    );

    expect(nextResources?.hand).toHaveLength(2);
    expect(nextResources?.discard).toEqual([
      { coin: selectedCoin, faceUp: false },
    ]);
    expect(nextState.currentPlayerId).not.toBe(currentPlayerId);
  });

  test('keeps the turn with the only player holding coins until the round ends', () => {
    const opponentResources = state.battlefield?.playerResources.find(
      (resources) => resources.playerId === 'player-one'
    );

    if (opponentResources === undefined) {
      throw new Error('The active duel must have resources for player one.');
    }

    opponentResources.discard = opponentResources.hand.map((coin) => ({
      coin,
      faceUp: false,
    }));
    opponentResources.hand = [];
    state.currentPlayerId = 'player-two';

    state = passCurrentCoin(state, 1);

    expect(state.currentPlayerId).toBe('player-two');
    expect(state.battlefield?.round).toBe(1);

    state = passCurrentCoin(state, 2);

    expect(state.currentPlayerId).toBe(state.initiativePlayerId);
    expect(state.battlefield?.round).toBe(2);
  });

  test('does not reveal a face-down discard to another player', () => {
    const currentPlayerId = state.currentPlayerId;
    const opponent = state.players.find(
      (player) => player.id !== currentPlayerId
    );
    const [event] = decide(state, currentPlayerId ?? '', {
      coinIndex: 0,
      type: 'PassTurn',
    });

    if (event === undefined || opponent === undefined) {
      throw new Error('The active duel must accept PassTurn.');
    }

    const ownerEvent = createViewEventFor(event, {
      playerId: currentPlayerId ?? '',
      role: 'player',
    });
    const opponentEvent = createViewEventFor(event, {
      playerId: opponent.id,
      role: 'player',
    });

    expect(JSON.stringify(ownerEvent)).toContain('"coin":{"kind"');
    expect(JSON.stringify(opponentEvent)).toContain(
      '"discard":[{"coin":null,"faceUp":false}]'
    );
  });

  test('draws from the bag before shuffling the discard', () => {
    state = passCurrentCoin(state, 6);

    expect(state.battlefield?.round).toBe(2);
    expect(
      state.battlefield?.playerResources.map((resources) => ({
        bag: resources.bag.length,
        discard: resources.discard.length,
        hand: resources.hand.length,
      }))
    ).toEqual([
      { bag: 3, discard: 3, hand: 3 },
      { bag: 3, discard: 3, hand: 3 },
    ]);

    state = passCurrentCoin(state, 12);

    expect(state.battlefield?.round).toBe(4);
    expect(
      state.battlefield?.playerResources.map((resources) => ({
        bag: resources.bag.length,
        discard: resources.discard.length,
        hand: resources.hand.length,
      }))
    ).toEqual([
      { bag: 6, discard: 0, hand: 3 },
      { bag: 6, discard: 0, hand: 3 },
    ]);
  });

  test('rejects a pass from a player who does not own the turn', () => {
    const opponent = state.players.find(
      (player) => player.id !== state.currentPlayerId
    );

    expect(
      decide(state, opponent?.id ?? '', { coinIndex: 0, type: 'PassTurn' })
    ).toEqual([]);
  });

  test('keeps team passing unavailable until the turn order is agreed', () => {
    const teamState = createActiveTeam();

    expect(
      decide(teamState, teamState.currentPlayerId ?? '', {
        coinIndex: 0,
        type: 'PassTurn',
      })
    ).toEqual([]);
  });
});

describe('recruiting and deploying supported units', () => {
  let state: GameState;
  let playerId: string;

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    state = createActiveDuel();
    playerId = state.currentPlayerId ?? '';

    const resources = state.battlefield?.playerResources.find(
      (item) => item.playerId === playerId
    );

    if (resources === undefined) {
      throw new Error('The active player must have battlefield resources.');
    }

    resources.hand = [
      { kind: 'unit', unitId: 'cavalry' },
      { kind: 'unit', unitId: 'cavalry' },
      { kind: 'royal' },
    ];
    resources.supply = [
      { count: 2, total: 4, unitId: 'cavalry' },
      { count: 3, total: 5, unitId: 'crossbowman' },
      { count: 3, total: 5, unitId: 'footman' },
    ];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('offers deployment on free owned control points for a supported unit', () => {
    const options = getTurnActionOptions(state, playerId, 0);
    const owner = state.players.find((player) => player.id === playerId);
    const expectedCells = state.battlefield?.controlPoints
      .filter((point) => point.ownerTeam === owner?.team)
      .map((point) => point.cellId);

    expect(options.deployCells).toEqual(expectedCells);
    expect(options.recruitUnits).toEqual(['cavalry', 'crossbowman']);
  });

  test('recruiting spends the chosen coin face down and adds a revealed supply coin', () => {
    const [event] = decide(state, playerId, {
      action: { type: 'recruit', unitId: 'crossbowman' },
      coinIndex: 2,
      type: 'PerformTurnAction',
    });

    expect(event?.type).toBe('TurnActionPerformed');

    if (event === undefined) {
      throw new Error('Recruitment must produce an event.');
    }

    const nextState = applyEvent(state, parseGameEventData(event));
    const resources = nextState.battlefield?.playerResources.find(
      (item) => item.playerId === playerId
    );

    expect(resources?.discard).toEqual([
      { coin: { kind: 'royal' }, faceUp: false },
      { coin: { kind: 'unit', unitId: 'crossbowman' }, faceUp: true },
    ]);
    expect(
      resources?.supply.find((item) => item.unitId === 'crossbowman')?.count
    ).toBe(2);
  });

  test('deployment creates one unit and then blocks another of the same type', () => {
    const [cellId] = getTurnActionOptions(state, playerId, 0).deployCells;

    if (cellId === undefined) {
      throw new Error('The player must own a free control point.');
    }

    const [event] = decide(state, playerId, {
      action: { cellId, type: 'deploy' },
      coinIndex: 0,
      type: 'PerformTurnAction',
    });

    if (event === undefined) {
      throw new Error('Deployment must produce an event.');
    }

    const nextState = applyEvent(state, event);
    nextState.currentPlayerId = playerId;

    expect(nextState.battlefield?.units).toEqual([
      {
        bolstered: 0,
        cellId,
        id: `${playerId}:1`,
        ownerId: playerId,
        unitId: 'cavalry',
      },
    ]);
    expect(getTurnActionOptions(nextState, playerId, 0).deployCells).toEqual(
      []
    );
  });

  test('draft preview preserves the confirmed state and does not draw coins', () => {
    const view = createViewFor(state, { playerId, role: 'player' });
    const [cellId] = getTurnActionOptions(view, playerId, 0).deployCells;

    if (cellId === undefined) {
      throw new Error('The player must own a free control point.');
    }

    const preview = previewTurnAction({
      action: { cellId, type: 'deploy' },
      coinIndex: 0,
      playerId,
      view,
    });

    expect(preview?.units).toHaveLength(1);
    expect(view.battlefield?.units).toHaveLength(0);
    expect(preview?.round).toBe(view.battlefield?.round);
    expect(
      preview?.playerResources.find((item) => item.playerId === playerId)
        ?.bagCount
    ).toBe(
      view.battlefield?.playerResources.find(
        (item) => item.playerId === playerId
      )?.bagCount
    );
  });

  test('keeps unsupported unit deployment unavailable', () => {
    const resources = state.battlefield?.playerResources.find(
      (item) => item.playerId === playerId
    );

    if (resources === undefined) {
      throw new Error('The active player must have resources.');
    }

    resources.hand = [{ kind: 'unit', unitId: 'footman' }];

    expect(getTurnActionOptions(state, playerId, 0).deployCells).toEqual([]);
  });
});

function createActiveDuel(): GameState {
  const gameCreated = createGame({
    creatorId: 'player-one',
    featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
    settings: {
      cardSelectionMode: 'random',
      expansions: [],
      format: 'duel',
    },
    type: 'CreateGame',
  });
  let state = applyEvent(null, gameCreated);
  const commands: readonly [string, GameCommandData][] = [
    ['player-one', { seat: 1, team: 'white', type: 'JoinGame' }],
    ['player-two', { seat: 1, team: 'black', type: 'JoinGame' }],
    ['player-one', { type: 'StartGame' }],
  ];

  for (const [playerId, command] of commands) {
    state = decide(state, playerId, command).reduce(applyEvent, state);
  }

  return state;
}

function createActiveTeam(): GameState {
  const gameCreated = createGame({
    creatorId: 'player-one',
    featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
    settings: {
      cardSelectionMode: 'random',
      expansions: [],
      format: 'team',
    },
    type: 'CreateGame',
  });
  let state = applyEvent(null, gameCreated);
  const commands: readonly [string, GameCommandData][] = [
    ['player-one', { seat: 1, team: 'white', type: 'JoinGame' }],
    ['player-two', { seat: 1, team: 'black', type: 'JoinGame' }],
    ['player-three', { seat: 2, team: 'white', type: 'JoinGame' }],
    ['player-four', { seat: 2, team: 'black', type: 'JoinGame' }],
    ['player-one', { type: 'StartGame' }],
  ];

  for (const [playerId, command] of commands) {
    state = decide(state, playerId, command).reduce(applyEvent, state);
  }

  return state;
}

function passCurrentCoin(state: GameState, count: number): GameState {
  let nextState = state;

  for (let index = 0; index < count; index += 1) {
    const playerId = nextState.currentPlayerId;

    if (playerId === null) {
      throw new Error('An active game must have a current player.');
    }

    nextState = decide(nextState, playerId, {
      coinIndex: 0,
      type: 'PassTurn',
    }).reduce(applyEvent, nextState);
  }

  return nextState;
}
