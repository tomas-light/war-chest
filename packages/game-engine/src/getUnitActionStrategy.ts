import type { BattlefieldUnit } from './Battlefield.js';
import type { UnitId } from './UnitId.js';

interface UnitActionStrategy {
  readonly unitId: UnitId;
  canDeploy(units: readonly BattlefieldUnit[], playerId: string): boolean;
}

abstract class StandardUnitStrategy implements UnitActionStrategy {
  abstract readonly unitId: UnitId;

  canDeploy(units: readonly BattlefieldUnit[], playerId: string): boolean {
    return !units.some(
      (unit) => unit.ownerId === playerId && unit.unitId === this.unitId
    );
  }
}

class LightCavalryStrategy extends StandardUnitStrategy {
  readonly unitId = 'lightCavalry';
}

class CavalryStrategy extends StandardUnitStrategy {
  readonly unitId = 'cavalry';
}

class CrossbowmanStrategy extends StandardUnitStrategy {
  readonly unitId = 'crossbowman';
}

class SwordsmanStrategy extends StandardUnitStrategy {
  readonly unitId = 'swordsman';
}

const UNIT_ACTION_STRATEGIES: Readonly<
  Partial<Record<UnitId, UnitActionStrategy>>
> = {
  lightCavalry: new LightCavalryStrategy(),
  cavalry: new CavalryStrategy(),
  crossbowman: new CrossbowmanStrategy(),
  swordsman: new SwordsmanStrategy(),
};

export function getUnitActionStrategy(
  unitId: UnitId
): UnitActionStrategy | null {
  return UNIT_ACTION_STRATEGIES[unitId] ?? null;
}
