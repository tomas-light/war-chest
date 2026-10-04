import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  type BattlefieldUnit,
  type GameCommandData,
  type GameState,
  type PerformTurnActionCommandData,
  applyEvent,
  createGame,
  createViewEventFor,
  createViewFor,
  decide,
  getTurnActionOptions,
  getUnitDefinition,
  getUnitTacticOptions,
  parseGameEventData,
  previewTurnAction,
} from '../src/index.js';

const STANDARD_UNIT_IDS = [
  'archer',
  'berserker',
  'cavalry',
  'crossbowman',
  'ensign',
  'knight',
  'lancer',
  'lightCavalry',
  'marshal',
  'pikeman',
  'royalGuard',
  'swordsman',
  'warriorPriest',
] as const;

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

describe.each(STANDARD_UNIT_IDS)('recruiting and deploying %s', (unitId) => {
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
      { kind: 'unit', unitId },
      { kind: 'unit', unitId },
      { kind: 'royal' },
    ];
    resources.supply = [
      { count: 2, total: getUnitDefinition(unitId).tokenCount, unitId },
      { count: 3, total: 5, unitId: 'mercenary' },
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
    expect(options.recruitUnits).toEqual([unitId]);
  });

  test('recruiting spends the chosen coin face down and adds a revealed supply coin', () => {
    const [event] = decide(state, playerId, {
      action: { type: 'recruit', unitId },
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
      { coin: { kind: 'unit', unitId }, faceUp: true },
    ]);
    expect(
      resources?.supply.find((item) => item.unitId === unitId)?.count
    ).toBe(1);
  });

  test('rejects recruitment when supply is exhausted', () => {
    const resources = state.battlefield?.playerResources.find(
      (item) => item.playerId === playerId
    );

    if (resources === undefined) {
      throw new Error('The active player must have resources.');
    }

    resources.supply = [
      { count: 0, total: getUnitDefinition(unitId).tokenCount, unitId },
    ];

    expect(
      decide(state, playerId, {
        action: { type: 'recruit', unitId },
        coinIndex: 0,
        type: 'PerformTurnAction',
      })
    ).toEqual([]);
  });

  test('previews recruitment without spending confirmed resources or drawing coins', () => {
    const view = createViewFor(state, { playerId, role: 'player' });
    const originalView = structuredClone(view);
    const preview = previewTurnAction({
      action: { type: 'recruit', unitId },
      coinIndex: 0,
      playerId,
      view,
    });
    const resources = preview?.playerResources.find(
      (item) => item.playerId === playerId
    );

    expect(resources?.handCount).toBe(2);
    expect(resources?.discard).toEqual([
      { coin: { kind: 'unit', unitId }, faceUp: false },
      { coin: { kind: 'unit', unitId }, faceUp: true },
    ]);
    expect(
      resources?.supply.find((item) => item.unitId === unitId)?.count
    ).toBe(1);
    expect(view).toEqual(originalView);
    expect(preview?.playerResources.map((item) => item.bagCount)).toEqual(
      view.battlefield?.playerResources.map((item) => item.bagCount)
    );
  });

  test('rejects deployment paid with a royal coin', () => {
    const [cellId] = getTurnActionOptions(state, playerId, 0).deployCells;

    if (cellId === undefined) {
      throw new Error('The player must own a free control point.');
    }

    expect(
      decide(state, playerId, {
        action: { cellId, type: 'deploy' },
        coinIndex: 2,
        type: 'PerformTurnAction',
      })
    ).toEqual([]);
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
        unitId,
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

    resources.hand = [{ kind: 'unit', unitId: 'mercenary' }];

    expect(getTurnActionOptions(state, playerId, 0).deployCells).toEqual([]);
  });
});

describe.each(STANDARD_UNIT_IDS)('ordinary movement of %s', (unitId) => {
  let state: GameState;
  let movingUnit: BattlefieldUnit;

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    state = createActiveDuel();
    state.currentPlayerId = 'player-one';

    if (state.battlefield === null) {
      throw new Error('The active duel must have a battlefield.');
    }

    const [resources] = state.battlefield.playerResources;

    if (resources === undefined) {
      throw new Error('The active player must have resources.');
    }

    resources.hand = [
      { kind: 'unit', unitId },
      { kind: 'unit', unitId: 'footman' },
      { kind: 'royal' },
    ];
    movingUnit = {
      bolstered: 2,
      cellId: 'B1',
      id: 'moving-unit',
      ownerId: 'player-one',
      unitId,
    };
    state.battlefield.units = [movingUnit];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('offers B1 neighbors within the board', () => {
    expect(getTurnActionOptions(state, 'player-one', 0).moves).toEqual([
      { battlefieldUnitId: 'moving-unit', cellIds: ['A1', 'B2', 'C1', 'C2'] },
    ]);
  });

  test('offers all six neighbors of D4', () => {
    movingUnit.cellId = 'D4';

    expect(getTurnActionOptions(state, 'player-one', 0).moves).toEqual([
      {
        battlefieldUnitId: 'moving-unit',
        cellIds: ['C3', 'C4', 'D3', 'D5', 'E4', 'E5'],
      },
    ]);
  });

  test('excludes both friendly and enemy occupied neighbors', () => {
    state.battlefield!.units.push(
      {
        bolstered: 0,
        cellId: 'C1',
        id: 'friendly-unit',
        ownerId: 'player-one',
        unitId: 'footman',
      },
      {
        bolstered: 0,
        cellId: 'C2',
        id: 'enemy-unit',
        ownerId: 'player-two',
        unitId,
      }
    );

    expect(getTurnActionOptions(state, 'player-one', 0).moves).toEqual([
      { battlefieldUnitId: 'moving-unit', cellIds: ['A1', 'B2'] },
    ]);
  });

  test('moves B1 to C2 with the same identity and bolstered coins', () => {
    const [event] = decide(state, 'player-one', {
      action: { battlefieldUnitId: 'moving-unit', cellId: 'C2', type: 'move' },
      coinIndex: 0,
      type: 'PerformTurnAction',
    });

    if (event === undefined) {
      throw new Error('A legal move must produce an event.');
    }

    const nextState = applyEvent(state, parseGameEventData(event));

    expect(nextState.battlefield?.units).toEqual([
      {
        bolstered: 2,
        cellId: 'C2',
        id: 'moving-unit',
        ownerId: 'player-one',
        unitId,
      },
    ]);
    expect(movingUnit.cellId).toBe('B1');
  });

  test('spends the matching hand coin face up and advances the turn', () => {
    const [event] = decide(state, 'player-one', {
      action: { battlefieldUnitId: 'moving-unit', cellId: 'C2', type: 'move' },
      coinIndex: 0,
      type: 'PerformTurnAction',
    });

    if (event === undefined) {
      throw new Error('A legal move must produce an event.');
    }

    const nextState = applyEvent(state, event);
    const [resources] = nextState.battlefield!.playerResources;

    expect(resources?.hand).toHaveLength(2);
    expect(resources?.discard).toEqual([
      { coin: { kind: 'unit', unitId }, faceUp: true },
    ]);
    expect(nextState.currentPlayerId).toBe('player-two');
  });

  test('reveals the spent maneuver coin to spectators', () => {
    const [event] = decide(state, 'player-one', {
      action: { battlefieldUnitId: 'moving-unit', cellId: 'C2', type: 'move' },
      coinIndex: 0,
      type: 'PerformTurnAction',
    });

    if (event === undefined) {
      throw new Error('A legal move must produce an event.');
    }

    const viewEvent = createViewEventFor(event, { role: 'spectator' });

    if (viewEvent.type !== 'TurnActionPerformed') {
      throw new Error('Movement must emit TurnActionPerformed.');
    }

    expect(viewEvent.payload.coin).toEqual({ kind: 'unit', unitId });
  });

  test.each([
    { cellId: 'C2', coinIndex: 1, name: 'another unit coin' },
    { cellId: 'C2', coinIndex: 2, name: 'a royal coin' },
    { cellId: 'D3', coinIndex: 0, name: 'a non-adjacent cell' },
    { cellId: 'B1', coinIndex: 0, name: 'the source cell' },
    { cellId: 'E1', coinIndex: 0, name: 'a cell outside the duel' },
  ] as const)('rejects movement using $name', ({ cellId, coinIndex }) => {
    expect(
      decide(state, 'player-one', {
        action: { battlefieldUnitId: 'moving-unit', cellId, type: 'move' },
        coinIndex,
        type: 'PerformTurnAction',
      })
    ).toEqual([]);
  });

  test('rejects moving an opponent unit', () => {
    movingUnit.ownerId = 'player-two';

    expect(
      decide(state, 'player-one', {
        action: {
          battlefieldUnitId: 'moving-unit',
          cellId: 'C2',
          type: 'move',
        },
        coinIndex: 0,
        type: 'PerformTurnAction',
      })
    ).toEqual([]);
  });

  test('leaves control point ownership unchanged when moving onto it', () => {
    movingUnit.cellId = 'A2';
    const [event] = decide(state, 'player-one', {
      action: { battlefieldUnitId: 'moving-unit', cellId: 'A3', type: 'move' },
      coinIndex: 0,
      type: 'PerformTurnAction',
    });

    if (event === undefined) {
      throw new Error('A legal move must produce an event.');
    }

    expect(applyEvent(state, event).battlefield?.controlPoints).toEqual(
      state.battlefield?.controlPoints
    );
  });

  test('previews movement without mutating the confirmed view or drawing coins', () => {
    const view = createViewFor(state, {
      playerId: 'player-one',
      role: 'player',
    });
    const originalView = structuredClone(view);
    const preview = previewTurnAction({
      action: { battlefieldUnitId: 'moving-unit', cellId: 'C2', type: 'move' },
      coinIndex: 0,
      playerId: 'player-one',
      view,
    });

    expect(preview?.units[0]?.cellId).toBe('C2');
    expect(view).toEqual(originalView);
    expect(preview?.round).toBe(view.battlefield?.round);
    expect(preview?.playerResources.map((item) => item.bagCount)).toEqual(
      view.battlefield?.playerResources.map((item) => item.bagCount)
    );
  });
});

describe('footman deployment and tactic', () => {
  let state: GameState;
  let command: PerformTurnActionCommandData;

  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    state = createActiveDuel();
    state.currentPlayerId = 'player-one';

    if (state.battlefield === null) {
      throw new Error('The active duel must have a battlefield.');
    }

    const [resources] = state.battlefield.playerResources;

    if (resources === undefined) {
      throw new Error('The active player must have resources.');
    }

    resources.hand = [
      { kind: 'unit', unitId: 'footman' },
      { kind: 'royal' },
      { kind: 'unit', unitId: 'archer' },
    ];
    resources.supply = [{ count: 3, total: 5, unitId: 'footman' }];
    state.battlefield.units = [
      {
        bolstered: 1,
        cellId: 'B1',
        id: 'first-footman',
        ownerId: 'player-one',
        unitId: 'footman',
      },
      {
        bolstered: 0,
        cellId: 'C2',
        id: 'second-footman',
        ownerId: 'player-one',
        unitId: 'footman',
      },
    ];
    command = {
      action: {
        type: 'tactic',
        unitId: 'footman',
        maneuvers: [
          { battlefieldUnitId: 'first-footman', cellId: 'C1', type: 'move' },
          { battlefieldUnitId: 'second-footman', cellId: 'B1', type: 'move' },
        ],
      },
      coinIndex: 0,
      type: 'PerformTurnAction',
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('recruits a footman from supply using a royal coin', () => {
    const [event] = decide(state, 'player-one', {
      action: { type: 'recruit', unitId: 'footman' },
      coinIndex: 1,
      type: 'PerformTurnAction',
    });

    if (event === undefined) {
      throw new Error('Recruitment must produce an event.');
    }

    const [resources] = applyEvent(state, event).battlefield!.playerResources;

    expect(resources?.supply).toEqual([
      { count: 2, total: 5, unitId: 'footman' },
    ]);
    expect(resources?.discard).toEqual([
      { coin: { kind: 'royal' }, faceUp: false },
      { coin: { kind: 'unit', unitId: 'footman' }, faceUp: true },
    ]);
  });

  test('deploys a second footman with a distinct identity', () => {
    state.battlefield!.units = state.battlefield!.units.slice(0, 1);
    const [cellId] = getTurnActionOptions(state, 'player-one', 0).deployCells;

    if (cellId === undefined) {
      throw new Error('The player must own a free control point.');
    }

    const [event] = decide(state, 'player-one', {
      action: { cellId, type: 'deploy' },
      coinIndex: 0,
      type: 'PerformTurnAction',
    });

    if (event === undefined) {
      throw new Error('Second deployment must produce an event.');
    }

    const [firstUnit] = state.battlefield!.units;

    expect(applyEvent(state, event).battlefield?.units).toEqual([
      firstUnit,
      {
        bolstered: 0,
        cellId,
        id: 'player-one:1',
        ownerId: 'player-one',
        unitId: 'footman',
      },
    ]);
  });

  test('rejects deploying a third footman', () => {
    expect(
      decide(state, 'player-one', {
        action: { cellId: 'A3', type: 'deploy' },
        coinIndex: 0,
        type: 'PerformTurnAction',
      })
    ).toEqual([]);
  });

  test('does not count the opponent footman toward the deployment limit', () => {
    state.battlefield!.units = state.battlefield!.units.map((unit) => {
      if (unit.id === 'second-footman') {
        return { ...unit, ownerId: 'player-two' };
      }

      return unit;
    });

    expect(getTurnActionOptions(state, 'player-one', 0).deployCells).toContain(
      'A3'
    );
  });

  test('ordinary movement moves only the selected footman', () => {
    const [event] = decide(state, 'player-one', {
      action: {
        battlefieldUnitId: 'first-footman',
        cellId: 'C1',
        type: 'move',
      },
      coinIndex: 0,
      type: 'PerformTurnAction',
    });

    if (event === undefined) {
      throw new Error('Ordinary movement must produce an event.');
    }

    expect(
      applyEvent(state, event).battlefield?.units.map((unit) => unit.cellId)
    ).toEqual(['C1', 'C2']);
  });

  test('offers the second move against the position after the first', () => {
    const options = getUnitTacticOptions({
      coinIndex: 0,
      game: state,
      maneuvers: [
        { battlefieldUnitId: 'first-footman', cellId: 'C1', type: 'move' },
      ],
      playerId: 'player-one',
    });

    expect(options?.moves).toEqual([
      {
        battlefieldUnitId: 'second-footman',
        cellIds: ['B1', 'B2', 'C3', 'D2', 'D3'],
      },
    ]);
  });

  test('commits two ordered movements with one payment and one turn transition', () => {
    const originalState = structuredClone(state);
    const [event] = decide(state, 'player-one', command);

    if (event === undefined) {
      throw new Error('The footman tactic must produce an event.');
    }

    const nextState = applyEvent(state, parseGameEventData(event));
    const [resources] = nextState.battlefield!.playerResources;

    expect(nextState.battlefield?.units).toEqual([
      {
        bolstered: 1,
        cellId: 'C1',
        id: 'first-footman',
        ownerId: 'player-one',
        unitId: 'footman',
      },
      {
        bolstered: 0,
        cellId: 'B1',
        id: 'second-footman',
        ownerId: 'player-one',
        unitId: 'footman',
      },
    ]);
    expect(resources?.hand).toHaveLength(2);
    expect(resources?.discard).toEqual([
      { coin: { kind: 'unit', unitId: 'footman' }, faceUp: true },
    ]);
    expect(nextState.moveCount).toBe(state.moveCount + 1);
    expect(nextState.currentPlayerId).toBe('player-two');
    expect(state).toEqual(originalState);
  });

  test.each([
    { maneuverCount: 0, isComplete: false },
    { maneuverCount: 1, isComplete: false },
    { maneuverCount: 2, isComplete: true },
  ])(
    'reports tactic completion after $maneuverCount movements',
    ({ maneuverCount, isComplete }) => {
      if (command.action.type !== 'tactic') {
        throw new Error('The command must contain a footman tactic.');
      }

      const options = getUnitTacticOptions({
        coinIndex: 0,
        game: state,
        maneuvers: command.action.maneuvers.slice(0, maneuverCount),
        playerId: 'player-one',
      });

      expect(options?.isComplete).toBe(isComplete);
    }
  );

  test.each([
    { maneuverCount: 0, canSave: false },
    { maneuverCount: 1, canSave: true },
    { maneuverCount: 2, canSave: true },
  ])(
    'reports whether a prefix of $maneuverCount movements can be saved',
    ({ maneuverCount, canSave }) => {
      if (command.action.type !== 'tactic') {
        throw new Error('The command must contain a footman tactic.');
      }

      const options = getUnitTacticOptions({
        coinIndex: 0,
        game: state,
        maneuvers: command.action.maneuvers.slice(0, maneuverCount),
        playerId: 'player-one',
      });

      expect(options?.canSave).toBe(canSave);
    }
  );

  test('rejects a tactic whose unit type differs from the paying coin', () => {
    if (command.action.type !== 'tactic') {
      throw new Error('The command must contain a footman tactic.');
    }

    command.action.unitId = 'archer';

    expect(decide(state, 'player-one', command)).toEqual([]);
  });

  test('rejects an incomplete tactic in a persisted event', () => {
    const [event] = decide(state, 'player-one', command);

    if (
      event?.type !== 'TurnActionPerformed' ||
      event.payload.action.type !== 'tactic'
    ) {
      throw new Error('The tactic must produce a TurnActionPerformed event.');
    }

    event.payload.action.maneuvers = event.payload.action.maneuvers.slice(0, 1);

    expect(() => parseGameEventData(event)).toThrow();
  });

  test('previews the first step but rejects confirming an incomplete tactic', () => {
    const action: PerformTurnActionCommandData['action'] = {
      type: 'tactic',
      unitId: 'footman',
      maneuvers: [
        { battlefieldUnitId: 'first-footman', cellId: 'C1', type: 'move' },
      ],
    };
    const view = createViewFor(state, {
      playerId: 'player-one',
      role: 'player',
    });

    expect(
      previewTurnAction({
        action,
        coinIndex: 0,
        playerId: 'player-one',
        view,
      })?.units.map((unit) => unit.cellId)
    ).toEqual(['C1', 'C2']);
    expect(decide(state, 'player-one', { ...command, action })).toEqual([]);
  });

  test('keeps a tactic unavailable when only one footman is on the field', () => {
    state.battlefield!.units = state.battlefield!.units.slice(0, 1);

    expect(
      getUnitTacticOptions({
        coinIndex: 0,
        game: state,
        maneuvers: [],
        playerId: 'player-one',
      })
    ).toBeNull();
    expect(getTurnActionOptions(state, 'player-one', 0).moves).toHaveLength(1);
  });

  test.each([
    { name: 'the royal coin', coinIndex: 1 },
    { name: 'another unit coin', coinIndex: 2 },
  ])('rejects a tactic paid with $name', ({ coinIndex }) => {
    expect(decide(state, 'player-one', { ...command, coinIndex })).toEqual([]);
  });

  test('rejects moving the same footman twice', () => {
    command.action = {
      type: 'tactic',
      unitId: 'footman',
      maneuvers: [
        { battlefieldUnitId: 'first-footman', cellId: 'C1', type: 'move' },
        { battlefieldUnitId: 'first-footman', cellId: 'D2', type: 'move' },
      ],
    };

    expect(decide(state, 'player-one', command)).toEqual([]);
  });

  test('rejects a first movement into a cell the second footman has not vacated yet', () => {
    command.action = {
      type: 'tactic',
      unitId: 'footman',
      maneuvers: [
        { battlefieldUnitId: 'first-footman', cellId: 'C2', type: 'move' },
        { battlefieldUnitId: 'second-footman', cellId: 'D3', type: 'move' },
      ],
    };

    expect(decide(state, 'player-one', command)).toEqual([]);
  });

  test('rejects a second movement into the first footman destination', () => {
    command.action = {
      type: 'tactic',
      unitId: 'footman',
      maneuvers: [
        { battlefieldUnitId: 'first-footman', cellId: 'C1', type: 'move' },
        { battlefieldUnitId: 'second-footman', cellId: 'C1', type: 'move' },
      ],
    };

    expect(decide(state, 'player-one', command)).toEqual([]);
  });

  test('rejects moving an opponent footman', () => {
    state.battlefield!.units = state.battlefield!.units.map((unit) => ({
      ...unit,
      ownerId: 'player-two',
    }));

    expect(decide(state, 'player-one', command)).toEqual([]);
  });

  test('reveals the tactic payment to spectators', () => {
    const [event] = decide(state, 'player-one', command);

    if (event === undefined) {
      throw new Error('The tactic must produce an event.');
    }

    const viewEvent = createViewEventFor(event, { role: 'spectator' });

    if (viewEvent.type !== 'TurnActionPerformed') {
      throw new Error('The tactic must emit TurnActionPerformed.');
    }

    expect(viewEvent.payload.coin).toEqual({ kind: 'unit', unitId: 'footman' });
    expect(viewEvent.payload.action).toEqual(command.action);
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
