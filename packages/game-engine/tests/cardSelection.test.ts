import { DEFAULT_RUNTIME_FEATURE_FLAGS } from '@war-chest/feature-flags';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  type GameEventData,
  type GamePlayer,
  type GameState,
  applyEvent,
  applyViewEvent,
  createViewEventFor,
  createViewFor,
  decide,
  getCurrentCardSelectionPlayer,
  UNIT_IDS,
} from '../src/index.js';

const TEAM_PLAYERS: readonly GamePlayer[] = [
  createPlayer('white-one', 'white', 1),
  createPlayer('white-two', 'white', 2),
  createPlayer('black-one', 'black', 1),
  createPlayer('black-two', 'black', 2),
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('first player selection', () => {
  test('uses the randomly selected participant as the first player', () => {
    const state = createWaitingState({
      cardSelectionMode: 'random',
      format: 'duel',
      players: TEAM_PLAYERS.slice(0, 2),
    });

    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const [firstStart] = decide(state, 'creator', { type: 'StartGame' });

    vi.mocked(Math.random).mockReturnValue(0);

    const [secondStart] = decide(state, 'creator', { type: 'StartGame' });

    expect(firstStart).toMatchObject({
      payload: { firstPlayerId: 'white-one' },
      type: 'GameStarted',
    });
    expect(secondStart).toMatchObject({
      payload: { firstPlayerId: 'white-two' },
      type: 'GameStarted',
    });
  });

  test.each([
    ['white-one', ['white-one', 'black-one', 'white-two', 'black-two']],
    ['white-two', ['white-two', 'black-one', 'white-one', 'black-two']],
    ['black-one', ['black-one', 'white-one', 'black-two', 'white-two']],
    ['black-two', ['black-two', 'white-one', 'black-one', 'white-two']],
  ])(
    'builds the alternating team order when %s is first',
    (firstPlayerId, expectedOrder) => {
      const players = [
        TEAM_PLAYERS.find((player) => player.id === firstPlayerId),
        ...TEAM_PLAYERS.filter((player) => player.id !== firstPlayerId),
      ].filter((player): player is GamePlayer => player !== undefined);

      const state = createWaitingState({
        cardSelectionMode: 'draft',
        format: 'team',
        players,
      });

      vi.spyOn(Math, 'random').mockReturnValue(0.999);

      const [, cardsPrepared] = decide(state, 'creator', {
        type: 'StartGame',
      });

      expect(cardsPrepared).toMatchObject({
        payload: { playerOrder: expectedOrder },
        type: 'CardsPrepared',
      });
    }
  );
});

describe('team draft', () => {
  let choiceEvents: GameEventData[];
  let completedState: GameState;

  beforeEach(() => {
    const waitingState = createWaitingState({
      cardSelectionMode: 'draft',
      format: 'team',
      players: TEAM_PLAYERS,
    });

    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const startEvents = decide(waitingState, 'creator', { type: 'StartGame' });
    let state = startEvents.reduce(applyEvent, waitingState);

    const expectedQueue = [
      'white-one',
      'black-one',
      'white-two',
      'black-two',
      'black-two',
      'white-two',
      'black-one',
      'white-one',
      'white-one',
      'black-one',
      'white-two',
      'black-two',
    ];

    choiceEvents = [];
    for (const [index, playerId] of expectedQueue.slice(0, -1).entries()) {
      const unitId = state.cardSelection?.pool[index];

      if (unitId === undefined) {
        throw new Error(`Choice ${index + 1} must have an available card.`);
      }

      const events = decide(state, playerId, {
        type: 'ConfirmCardChoice',
        unitId,
      });

      if (events.length === 0) {
        throw new Error(`Choice ${index + 1} must be accepted.`);
      }

      choiceEvents.push(
        ...events.filter((event) => event.type === 'CardChoiceConfirmed')
      );
      state = events.reduce(applyEvent, state);
    }

    completedState = state;
  });

  test('alternates forward and reverse player passes', () => {
    expect(
      choiceEvents.map((event) =>
        event.type === 'CardChoiceConfirmed' ? event.payload.playerId : null
      )
    ).toEqual([
      'white-one',
      'black-one',
      'white-two',
      'black-two',
      'black-two',
      'white-two',
      'black-one',
      'white-one',
      'white-one',
      'black-one',
      'white-two',
      'black-two',
    ]);
  });

  test('assigns three unique cards to every player', () => {
    const assignedCards = completedState.players.flatMap(
      (player) => player.cardIds
    );

    expect(
      completedState.players.map((player) => player.cardIds.length)
    ).toEqual([3, 3, 3, 3]);
    expect(new Set(assignedCards).size).toBe(12);
  });

  test('opens the table automatically after the penultimate pick', () => {
    expect(completedState).toMatchObject({
      cardSelection: null,
      status: 'active',
    });
  });

  test('returns initiative to the first player when the table opens', () => {
    expect(completedState).toMatchObject({
      currentPlayerId: 'white-one',
      firstPlayerId: 'white-one',
      initiativePlayerId: 'white-one',
    });
  });
});

describe.each([
  {
    format: 'duel',
    mode: 'draft',
    players: [TEAM_PLAYERS[0], TEAM_PLAYERS[2]],
    finalPlayer: 'white-one',
  },
  {
    format: 'duel',
    mode: 'eliminationDraft',
    players: [TEAM_PLAYERS[0], TEAM_PLAYERS[2]],
    finalPlayer: 'white-one',
  },
  {
    format: 'team',
    mode: 'draft',
    players: TEAM_PLAYERS,
    finalPlayer: 'black-two',
  },
  {
    format: 'team',
    mode: 'eliminationDraft',
    players: TEAM_PLAYERS,
    finalPlayer: 'black-two',
  },
] as const)(
  '$format $mode automatic final card',
  ({ format, mode, players, finalPlayer }) => {
    let state: GameState;
    let finalEvents: GameEventData[];
    let remainingUnitId: string;

    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.999);
      const waitingState = createWaitingState({
        cardSelectionMode: mode,
        format,
        players,
      });
      state = decide(waitingState, 'creator', { type: 'StartGame' }).reduce(
        applyEvent,
        waitingState
      );

      while (state.cardSelection !== null) {
        const selection = state.cardSelection;
        const remaining = selection.pool.filter(
          (unitId) =>
            !selection.choices.some((choice) => choice.unitId === unitId)
        );
        const [unitId, lastUnitId] = remaining;
        const playerId = getCurrentCardSelectionPlayer(selection);

        if (unitId === undefined || playerId === null) {
          throw new Error('The current player must have an available card.');
        }

        if (remaining.length === 2 && lastUnitId !== undefined) {
          remainingUnitId = lastUnitId;
          finalEvents = decide(state, playerId, {
            type: 'ConfirmCardChoice',
            unitId,
          });
          break;
        }

        state = decide(state, playerId, {
          type: 'ConfirmCardChoice',
          unitId,
        }).reduce(applyEvent, state);
      }
    });

    test('emits the last two assignments and table activation in one ordered batch', () => {
      expect(
        finalEvents.map((event) => ({
          type: event.type,
          sequence: event.sequence,
        }))
      ).toEqual([
        { type: 'CardChoiceConfirmed', sequence: state.lastEventSequence + 1 },
        { type: 'CardChoiceConfirmed', sequence: state.lastEventSequence + 2 },
        {
          type: 'BattlefieldPrepared',
          sequence: state.lastEventSequence + 3,
        },
        {
          type: 'CardSelectionCompleted',
          sequence: state.lastEventSequence + 4,
        },
      ]);
    });

    test('assigns the only remaining card to the final player in the snake order', () => {
      const [, automaticChoice] = finalEvents;
      expect(automaticChoice).toMatchObject({
        payload: {
          action: 'pick',
          playerId: finalPlayer,
          unitId: remainingUnitId,
          isComplete: true,
        },
      });
    });

    test('replays the automatic completion into an active game with full rosters', () => {
      const activeState = finalEvents.reduce(applyEvent, state);

      expect(activeState.status).toBe('active');
      expect(activeState.cardSelection).toBeNull();
      expect(
        activeState.players.map((player) => player.cardIds.length)
      ).toEqual(players.map(() => (format === 'duel' ? 4 : 3)));
    });

    test('applies the complete batch to the spectator view', () => {
      const spectator = { role: 'spectator' } as const;
      const view = createViewFor(state, spectator);
      const viewEvents = finalEvents.map((event) =>
        createViewEventFor(event, spectator)
      );

      expect(viewEvents.reduce(applyViewEvent, view)).toEqual(
        createViewFor(finalEvents.reduce(applyEvent, state), spectator)
      );
    });

    test('does not require the automatic recipient to be connected', () => {
      const disconnectedState = {
        ...state,
        players: state.players.map((player) =>
          player.id === finalPlayer
            ? { ...player, presence: 'disconnected' as const }
            : player
        ),
      };
      const [manualChoice] = finalEvents;

      if (manualChoice?.type !== 'CardChoiceConfirmed') {
        throw new Error('Expected the penultimate manual pick.');
      }

      expect(
        decide(disconnectedState, manualChoice.payload.playerId, {
          type: 'ConfirmCardChoice',
          unitId: manualChoice.payload.unitId,
        })
      ).toEqual(finalEvents);
    });

    test('rejects explicit completion while two cards remain', () => {
      expect(
        decide(state, finalPlayer, { type: 'CompleteCardSelection' })
      ).toEqual([]);
    });

    test('resumes a legacy saved selection with just one card left', () => {
      const [manualChoice] = finalEvents;
      if (manualChoice === undefined) {
        throw new Error('Expected the penultimate manual pick.');
      }

      const legacyState = applyEvent(state, manualChoice);

      expect(
        decide(legacyState, finalPlayer, { type: 'CompleteCardSelection' })
      ).toEqual(finalEvents.slice(1));
    });

    test('does not allow a spectator to complete a legacy saved selection', () => {
      const legacyState = finalEvents.slice(0, 2).reduce(applyEvent, state);
      expect(
        decide(legacyState, 'spectator', { type: 'CompleteCardSelection' })
      ).toEqual([]);
    });

    test('resumes a legacy fully distributed selection without assigning extra cards', () => {
      const legacyState = finalEvents.slice(0, 2).reduce(applyEvent, state);
      expect(
        decide(legacyState, finalPlayer, { type: 'CompleteCardSelection' })
      ).toEqual(finalEvents.slice(2));
    });
  }
);

describe('elimination draft', () => {
  test('gives every player one ban before the draft begins', () => {
    const waitingState = createWaitingState({
      cardSelectionMode: 'eliminationDraft',
      format: 'team',
      players: TEAM_PLAYERS,
    });

    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const startEvents = decide(waitingState, 'creator', { type: 'StartGame' });
    let state = startEvents.reduce(applyEvent, waitingState);

    const banQueue = ['white-one', 'black-one', 'white-two', 'black-two'];

    for (const [index, playerId] of banQueue.entries()) {
      const unitId = state.cardSelection?.pool[index];

      if (unitId === undefined) {
        throw new Error(`Ban ${index + 1} must have an available card.`);
      }

      const [event] = decide(state, playerId, {
        type: 'ConfirmCardChoice',
        unitId,
      });

      if (event === undefined) {
        throw new Error(`Ban ${index + 1} must be accepted.`);
      }

      state = applyEvent(state, event);
    }

    expect(state.cardSelection).toMatchObject({
      phase: 'picking',
      choices: banQueue.map((playerId, index) => ({
        action: 'ban',
        playerId,
        unitId: UNIT_IDS[index],
      })),
    });
    expect(state.currentPlayerId).toBe('white-one');
  });

  test('creates the required elimination pool for each format', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const duelState = createWaitingState({
      cardSelectionMode: 'eliminationDraft',
      format: 'duel',
      players: TEAM_PLAYERS.slice(0, 2),
    });
    const teamState = createWaitingState({
      cardSelectionMode: 'eliminationDraft',
      format: 'team',
      players: TEAM_PLAYERS,
    });

    const duel = decide(duelState, 'creator', { type: 'StartGame' }).reduce(
      applyEvent,
      duelState
    );
    const team = decide(teamState, 'creator', { type: 'StartGame' }).reduce(
      applyEvent,
      teamState
    );

    expect(duel.cardSelection?.pool).toHaveLength(10);
    expect(team.cardSelection?.pool).toHaveLength(16);
  });
});

describe('random card selection', () => {
  test('deals unique cards and skips the selection stage', () => {
    const waitingState = createWaitingState({
      cardSelectionMode: 'random',
      format: 'team',
      players: TEAM_PLAYERS,
    });

    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const startEvents = decide(waitingState, 'creator', { type: 'StartGame' });
    const state = startEvents.reduce(applyEvent, waitingState);
    const assignedCards = state.players.flatMap((player) => player.cardIds);

    expect(state.cardSelection).toBeNull();
    expect(state.status).toBe('active');
    expect(state.players.map((player) => player.cardIds.length)).toEqual([
      3, 3, 3, 3,
    ]);
    expect(new Set(assignedCards).size).toBe(12);
    expect(
      state.battlefield?.controlPoints.find((point) => point.cellId === 'F7')
    ).toEqual({ cellId: 'F7', fortified: false, ownerTeam: 'black' });
    expect(
      state.battlefield?.controlPoints.find((point) => point.cellId === 'E4')
    ).toEqual({ cellId: 'E4', fortified: false, ownerTeam: null });
    expect(
      state.battlefield?.controlPoints.find((point) => point.cellId === 'A3')
    ).toEqual({ cellId: 'A3', fortified: false, ownerTeam: 'white' });
    expect(state.battlefield?.units).toEqual([]);
    expect(state.battlefield?.controlPoints).toHaveLength(14);
    expect(
      state.battlefield?.playerResources.map((resources) => ({
        bag: resources.bag.length,
        hand: resources.hand.length,
        supply: resources.supply.length,
      }))
    ).toEqual(TEAM_PLAYERS.map(() => ({ bag: 3, hand: 3, supply: 3 })));

    const spectatorView = createViewFor(state, { role: 'spectator' });
    expect(
      spectatorView.battlefield?.playerResources.map((resources) => ({
        bagCount: resources.bagCount,
        hand: resources.hand,
      }))
    ).toEqual(
      TEAM_PLAYERS.map(() => ({
        bagCount: null,
        hand: null,
      }))
    );

    const playerView = createViewFor(state, {
      playerId: 'white-one',
      role: 'player',
    });
    expect(playerView.battlefield?.playerResources[0]?.bagCount).toBe(3);
    expect(playerView.battlefield?.playerResources[0]?.hand).toHaveLength(3);
    expect(playerView.battlefield?.playerResources[1]?.bagCount).toBeNull();
    expect(playerView.battlefield?.playerResources[1]?.hand).toBeNull();
  });
});

interface CreateWaitingStateInput {
  cardSelectionMode: 'draft' | 'eliminationDraft' | 'random';
  format: 'duel' | 'team';
  players: readonly GamePlayer[];
}

function createWaitingState(input: CreateWaitingStateInput): GameState {
  return {
    battlefield: null,
    cardSelection: null,
    creatorId: 'creator',
    currentPlayerId: null,
    featureFlags: DEFAULT_RUNTIME_FEATURE_FLAGS,
    firstPlayerId: null,
    initiativePlayerId: null,
    lastEventSequence: input.players.length + 1,
    moveCount: 0,
    players: input.players,
    rulesVersion: 2,
    settings: {
      cardSelectionMode: input.cardSelectionMode,
      expansions: [],
      format: input.format,
    },
    status: 'waiting',
    teams: {
      black: input.players
        .filter((player) => player.team === 'black')
        .map((player) => player.id),
      white: input.players
        .filter((player) => player.team === 'white')
        .map((player) => player.id),
    },
    winnerTeam: null,
  };
}

function createPlayer(
  id: string,
  team: 'black' | 'white',
  seat: number
): GamePlayer {
  return {
    cardIds: [],
    defeatReason: null,
    id,
    moveCount: 0,
    presence: 'connected',
    privateMoves: [],
    reconnectDeadline: null,
    seat,
    team,
  };
}
