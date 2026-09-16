import type { CardSelectionMode, GameFormat } from './GameSettings.js';
import type { GamePlayer } from './state.js';
import { type UnitId, UNIT_IDS } from './UnitId.js';

export type CardSelectionAction = 'ban' | 'pick';
export type CardSelectionPhase = 'banning' | 'complete' | 'picking';

export interface ConfirmedCardChoice {
  action: CardSelectionAction;
  playerId: string;
  unitId: UnitId;
}

export interface CardSelection {
  choices: readonly ConfirmedCardChoice[];
  phase: CardSelectionPhase;
  playerOrder: readonly string[];
  pool: readonly UnitId[];
}

export type PlayerUnitAssignment = {
  playerId: string;
  unitIds: readonly UnitId[];
};

export type GameStartSelection =
  | {
      assignments: readonly PlayerUnitAssignment[];
      mode: 'random';
    }
  | {
      mode: 'draft' | 'eliminationDraft';
      pool: readonly UnitId[];
    };

interface CreateGameStartInput {
  format: GameFormat;
  mode: CardSelectionMode;
  players: readonly GamePlayer[];
}

interface CreateNextCardChoiceInput {
  action: CardSelectionAction;
  playerId: string;
  state: CardSelection;
  unitId: UnitId;
}

export interface NextCardChoice {
  choice: ConfirmedCardChoice;
  isComplete: boolean;
  nextPhase: CardSelectionPhase;
  nextPlayerId: string | null;
}

export function createGameStart(input: CreateGameStartInput): {
  firstPlayerId: string;
  playerOrder: readonly string[];
  selection: GameStartSelection;
} {
  const shuffledPlayers = shuffle(input.players);
  const [firstPlayer] = shuffledPlayers;

  if (firstPlayer === undefined) {
    throw new Error('A game cannot start without players.');
  }

  const playerOrder = createPlayerOrder({
    firstPlayerId: firstPlayer.id,
    format: input.format,
    players: input.players,
  });
  const shuffledUnits = shuffle(UNIT_IDS);

  if (input.mode === 'random') {
    return {
      firstPlayerId: firstPlayer.id,
      playerOrder,
      selection: {
        assignments: createRandomAssignments({
          format: input.format,
          playerOrder,
          shuffledUnits,
        }),
        mode: 'random',
      },
    };
  }

  return {
    firstPlayerId: firstPlayer.id,
    playerOrder,
    selection: {
      mode: input.mode,
      pool: shuffledUnits.slice(
        0,
        getSelectionPoolSize(input.format, input.mode)
      ),
    },
  };
}

export function createNextCardChoice(
  input: CreateNextCardChoiceInput
): NextCardChoice | null {
  if (!input.state.pool.includes(input.unitId)) {
    return null;
  }

  if (input.state.choices.some((choice) => choice.unitId === input.unitId)) {
    return null;
  }

  const currentPlayerId = getCurrentCardSelectionPlayer(input.state);

  if (currentPlayerId !== input.playerId) {
    return null;
  }

  const expectedAction = input.state.phase === 'banning' ? 'ban' : 'pick';

  if (input.action !== expectedAction) {
    return null;
  }

  const choice: ConfirmedCardChoice = {
    action: input.action,
    playerId: input.playerId,
    unitId: input.unitId,
  };
  const choices = [...input.state.choices, choice];
  const banCount = choices.filter((item) => item.action === 'ban').length;
  const pickCount = choices.length - banCount;
  const requiredPickCount = getRequiredPickCount(
    input.state.playerOrder.length
  );

  if (pickCount === requiredPickCount) {
    return {
      choice,
      isComplete: true,
      nextPhase: 'complete',
      nextPlayerId: null,
    };
  }

  const hasCompletedBans =
    input.state.phase === 'banning' &&
    banCount === input.state.playerOrder.length;
  const nextPhase = hasCompletedBans ? 'picking' : input.state.phase;
  const nextState: CardSelection = {
    ...input.state,
    choices,
    phase: nextPhase,
  };

  return {
    choice,
    isComplete: false,
    nextPhase,
    nextPlayerId: getCurrentCardSelectionPlayer(nextState),
  };
}

export function getCurrentCardSelectionPlayer(
  selection: CardSelection
): string | null {
  const banCount = selection.choices.filter(
    (choice) => choice.action === 'ban'
  ).length;

  if (selection.phase === 'banning') {
    return selection.playerOrder[banCount] ?? null;
  }

  if (selection.phase === 'complete') {
    return null;
  }

  const pickCount = selection.choices.length - banCount;
  const queue = createDraftQueue(selection.playerOrder);

  return queue[pickCount] ?? null;
}

export function cloneCardSelection(
  selection: CardSelection | null
): CardSelection | null {
  if (selection === null) {
    return null;
  }

  return {
    choices: selection.choices.map((choice) => ({ ...choice })),
    phase: selection.phase,
    playerOrder: [...selection.playerOrder],
    pool: [...selection.pool],
  };
}

export function cloneGameStartSelection(
  selection: GameStartSelection
): GameStartSelection {
  if (selection.mode === 'random') {
    return {
      assignments: selection.assignments.map((assignment) => ({
        playerId: assignment.playerId,
        unitIds: [...assignment.unitIds],
      })),
      mode: selection.mode,
    };
  }

  return { mode: selection.mode, pool: [...selection.pool] };
}

interface CreatePlayerOrderInput {
  firstPlayerId: string;
  format: GameFormat;
  players: readonly GamePlayer[];
}

function createPlayerOrder(input: CreatePlayerOrderInput): readonly string[] {
  const firstPlayer = input.players.find(
    (player) => player.id === input.firstPlayerId
  );

  if (firstPlayer === undefined) {
    throw new Error('The first player must belong to the game.');
  }

  if (input.format === 'duel') {
    const secondPlayer = input.players.find(
      (player) => player.id !== firstPlayer.id
    );

    if (secondPlayer === undefined) {
      throw new Error('A duel requires a second player.');
    }

    return [firstPlayer.id, secondPlayer.id];
  }

  const opposingPlayers = input.players
    .filter((player) => player.team !== firstPlayer.team)
    .sort((first, second) => first.seat - second.seat);
  const teammate = input.players.find(
    (player) => player.id !== firstPlayer.id && player.team === firstPlayer.team
  );
  const [secondPlayer, fourthPlayer] = opposingPlayers;

  if (
    secondPlayer === undefined ||
    teammate === undefined ||
    fourthPlayer === undefined
  ) {
    throw new Error('A team game requires two complete teams.');
  }

  return [firstPlayer.id, secondPlayer.id, teammate.id, fourthPlayer.id];
}

interface CreateRandomAssignmentsInput {
  format: GameFormat;
  playerOrder: readonly string[];
  shuffledUnits: readonly UnitId[];
}

function createRandomAssignments(
  input: CreateRandomAssignmentsInput
): readonly PlayerUnitAssignment[] {
  const unitCount = getPlayerUnitCount(input.format);

  return input.playerOrder.map((playerId, playerIndex) => ({
    playerId,
    unitIds: input.shuffledUnits.slice(
      playerIndex * unitCount,
      (playerIndex + 1) * unitCount
    ),
  }));
}

function createDraftQueue(playerOrder: readonly string[]): readonly string[] {
  const unitCount =
    getRequiredPickCount(playerOrder.length) / playerOrder.length;
  const queue: string[] = [];

  for (let round = 0; round < unitCount; round += 1) {
    if (round % 2 === 0) {
      queue.push(...playerOrder);
    } else {
      queue.push(...[...playerOrder].reverse());
    }
  }

  return queue;
}

function getSelectionPoolSize(
  format: GameFormat,
  mode: Exclude<CardSelectionMode, 'random'>
): number {
  let playerCount: number;

  if (format === 'duel') {
    playerCount = 2;
  } else {
    playerCount = 4;
  }

  const selectedCardCount = getRequiredPickCount(playerCount);

  if (mode === 'eliminationDraft') {
    return selectedCardCount + playerCount;
  }

  return selectedCardCount;
}

function getRequiredPickCount(playerCount: number): number {
  return playerCount === 2 ? 8 : 12;
}

function getPlayerUnitCount(format: GameFormat): number {
  return format === 'duel' ? 4 : 3;
}

function shuffle<Value>(values: readonly Value[]): Value[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = getRandomIndex(index + 1);
    [result[index], result[randomIndex]] = [
      result[randomIndex] as Value,
      result[index] as Value,
    ];
  }

  return result;
}

function getRandomIndex(upperBound: number): number {
  return Math.floor(Math.random() * upperBound);
}
