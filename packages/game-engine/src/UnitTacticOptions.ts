import type { BattlefieldUnit } from './Battlefield.js';
import type { TurnActionOptions } from './getTurnActionOptions.js';
import type { UnitId } from './UnitId.js';

export interface UnitTacticOptions {
  canSave: boolean;
  isComplete: boolean;
  maneuverLimit: number;
  moves: TurnActionOptions['moves'];
  unitId: UnitId;
  units: BattlefieldUnit[];
}
