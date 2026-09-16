import type { UnitId } from './UnitId.js';

export interface UnitDefinition {
  tokenCount: 4 | 5;
  unitId: UnitId;
}

const UNIT_DEFINITIONS: Readonly<Record<UnitId, UnitDefinition>> = {
  archer: { tokenCount: 4, unitId: 'archer' },
  berserker: { tokenCount: 5, unitId: 'berserker' },
  cavalry: { tokenCount: 4, unitId: 'cavalry' },
  crossbowman: { tokenCount: 5, unitId: 'crossbowman' },
  ensign: { tokenCount: 5, unitId: 'ensign' },
  footman: { tokenCount: 5, unitId: 'footman' },
  knight: { tokenCount: 4, unitId: 'knight' },
  lancer: { tokenCount: 4, unitId: 'lancer' },
  lightCavalry: { tokenCount: 5, unitId: 'lightCavalry' },
  marshal: { tokenCount: 5, unitId: 'marshal' },
  mercenary: { tokenCount: 5, unitId: 'mercenary' },
  pikeman: { tokenCount: 4, unitId: 'pikeman' },
  royalGuard: { tokenCount: 5, unitId: 'royalGuard' },
  scout: { tokenCount: 5, unitId: 'scout' },
  swordsman: { tokenCount: 5, unitId: 'swordsman' },
  warriorPriest: { tokenCount: 4, unitId: 'warriorPriest' },
};

export function getUnitDefinition(unitId: UnitId): UnitDefinition {
  return UNIT_DEFINITIONS[unitId];
}
