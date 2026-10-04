import type { TurnAction } from './command-data/TurnCommandData.js';
import { getUnitActionStrategy } from './getUnitActionStrategy.js';
import type { UnitTacticValidationMode } from './UnitTacticInput.js';

type TacticAction = Extract<TurnAction, { type: 'tactic' }>;

export function isUnitTacticActionValid(
  action: TacticAction,
  mode: UnitTacticValidationMode
): boolean {
  return (
    getUnitActionStrategy(action.unitId)?.isTacticActionValid(
      action.maneuvers,
      mode
    ) ?? false
  );
}
