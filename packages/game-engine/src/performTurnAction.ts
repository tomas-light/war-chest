import { advanceTurn } from './advanceTurn.js';
import { type BattlefieldState, cloneBattlefield } from './Battlefield.js';
import type { TurnAction } from './command-data/TurnCommandData.js';
import { cloneGameCoin } from './GameCoin.js';
import { getTurnActionOptions } from './getTurnActionOptions.js';
import { getUnitTacticOptions } from './getUnitTacticOptions.js';
import type { GameState } from './state.js';

interface Input {
  action: TurnAction;
  coinIndex: number;
  playerId: string;
  state: GameState;
}

export interface PerformTurnActionResult {
  battlefield: BattlefieldState;
  nextPlayerId: string;
}

export function performTurnAction(
  input: Input
): PerformTurnActionResult | null {
  const { action, coinIndex, playerId, state } = input;

  const options = getTurnActionOptions(state, playerId, coinIndex);
  const currentBattlefield = state.battlefield;
  const tacticOptions =
    action.type === 'tactic'
      ? getUnitTacticOptions({
          coinIndex,
          game: state,
          maneuvers: action.maneuvers,
          playerId,
        })
      : null;

  if (currentBattlefield === null) {
    return null;
  }

  if (
    action.type === 'tactic' &&
    (tacticOptions?.isComplete !== true ||
      tacticOptions.unitId !== action.unitId)
  ) {
    return null;
  }

  if (
    action.type === 'recruit' &&
    !options.recruitUnits.includes(action.unitId)
  ) {
    return null;
  }

  if (
    action.type === 'deploy' &&
    !options.deployCells.includes(action.cellId)
  ) {
    return null;
  }

  if (
    action.type === 'move' &&
    !options.moves.some(
      (move) =>
        move.battlefieldUnitId === action.battlefieldUnitId &&
        move.cellIds.includes(action.cellId)
    )
  ) {
    return null;
  }

  const battlefield = cloneBattlefield(currentBattlefield);
  const resources = battlefield.playerResources.find(
    (item) => item.playerId === playerId
  );
  const selectedCoin = resources?.hand.at(coinIndex);

  if (resources === undefined || selectedCoin === undefined) {
    return null;
  }

  resources.hand.splice(coinIndex, 1);

  if (action.type === 'recruit') {
    const supply = resources.supply.find(
      (item) => item.unitId === action.unitId
    );

    if (supply === undefined) {
      return null;
    }

    supply.count -= 1;
    resources.discard.push({
      coin: cloneGameCoin(selectedCoin),
      faceUp: false,
    });
    resources.discard.push({
      coin: { kind: 'unit', unitId: action.unitId },
      faceUp: true,
    });
  } else if (action.type === 'tactic') {
    if (tacticOptions === null) {
      return null;
    }

    battlefield.units = tacticOptions.units;
    resources.discard.push({ coin: cloneGameCoin(selectedCoin), faceUp: true });
  } else if (action.type === 'move') {
    const unit = battlefield.units.find(
      (item) => item.id === action.battlefieldUnitId
    );

    if (unit === undefined) {
      return null;
    }

    unit.cellId = action.cellId;
    resources.discard.push({
      coin: cloneGameCoin(selectedCoin),
      faceUp: true,
    });
  } else {
    if (selectedCoin.kind !== 'unit') {
      return null;
    }

    battlefield.units.push({
      bolstered: 0,
      cellId: action.cellId,
      id: `${playerId}:${state.moveCount + 1}`,
      ownerId: playerId,
      unitId: selectedCoin.unitId,
    });
  }

  const nextPlayerId = advanceTurn({ battlefield, playerId, state });

  if (nextPlayerId === null) {
    return null;
  }

  return { battlefield, nextPlayerId };
}
