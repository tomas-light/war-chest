import { ArcherStrategy } from './unitActionStrategies/ArcherStrategy.js';
import { BerserkerStrategy } from './unitActionStrategies/BerserkerStrategy.js';
import { CavalryStrategy } from './unitActionStrategies/CavalryStrategy.js';
import { CrossbowmanStrategy } from './unitActionStrategies/CrossbowmanStrategy.js';
import { EnsignStrategy } from './unitActionStrategies/EnsignStrategy.js';
import { KnightStrategy } from './unitActionStrategies/KnightStrategy.js';
import { LancerStrategy } from './unitActionStrategies/LancerStrategy.js';
import { LightCavalryStrategy } from './unitActionStrategies/LightCavalryStrategy.js';
import { MarshalStrategy } from './unitActionStrategies/MarshalStrategy.js';
import { PikemanStrategy } from './unitActionStrategies/PikemanStrategy.js';
import { RoyalGuardStrategy } from './unitActionStrategies/RoyalGuardStrategy.js';
import type { StandardUnitStrategy } from './unitActionStrategies/StandardUnitStrategy.js';
import { SwordsmanStrategy } from './unitActionStrategies/SwordsmanStrategy.js';
import { WarriorPriestStrategy } from './unitActionStrategies/WarriorPriestStrategy.js';
import type { UnitId } from './UnitId.js';

const UNIT_ACTION_STRATEGIES: Readonly<
  Partial<Record<UnitId, StandardUnitStrategy>>
> = {
  archer: new ArcherStrategy(),
  berserker: new BerserkerStrategy(),
  cavalry: new CavalryStrategy(),
  crossbowman: new CrossbowmanStrategy(),
  ensign: new EnsignStrategy(),
  knight: new KnightStrategy(),
  lancer: new LancerStrategy(),
  lightCavalry: new LightCavalryStrategy(),
  marshal: new MarshalStrategy(),
  pikeman: new PikemanStrategy(),
  royalGuard: new RoyalGuardStrategy(),
  swordsman: new SwordsmanStrategy(),
  warriorPriest: new WarriorPriestStrategy(),
};

export function getUnitActionStrategy(
  unitId: UnitId
): StandardUnitStrategy | null {
  return UNIT_ACTION_STRATEGIES[unitId] ?? null;
}
