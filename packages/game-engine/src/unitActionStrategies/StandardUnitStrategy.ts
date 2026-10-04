import type { BattlefieldUnit } from '../Battlefield.js';
import type { UnitManeuver } from '../command-data/TurnCommandData.js';
import type { UnitId } from '../UnitId.js';
import type {
  UnitTacticInput,
  UnitTacticValidationMode,
} from '../UnitTacticInput.js';
import type { UnitTacticOptions } from '../UnitTacticOptions.js';

export abstract class StandardUnitStrategy {
  abstract readonly unitId: UnitId;

  getTacticOptions(input: UnitTacticInput): UnitTacticOptions | null {
    void input;

    return null;
  }

  isTacticActionValid(
    maneuvers: readonly UnitManeuver[],
    mode: UnitTacticValidationMode
  ): boolean {
    void maneuvers;
    void mode;

    return false;
  }

  canDeploy(units: readonly BattlefieldUnit[], playerId: string): boolean {
    return !units.some(
      (unit) => unit.ownerId === playerId && unit.unitId === this.unitId
    );
  }
}
