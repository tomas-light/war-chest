import type { BattlefieldUnit } from '../Battlefield.js';
import type { UnitId } from '../UnitId.js';

export abstract class StandardUnitStrategy {
  abstract readonly unitId: UnitId;

  canDeploy(units: readonly BattlefieldUnit[], playerId: string): boolean {
    return !units.some(
      (unit) => unit.ownerId === playerId && unit.unitId === this.unitId
    );
  }
}
