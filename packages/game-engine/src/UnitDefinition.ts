import type { UnitId } from './UnitId.js';

export interface UnitDefinition {
  canAttack: boolean;
  hasTactic: boolean;
  tokenCount: 4 | 5;
  unitId: UnitId;
}

const UNIT_DEFINITIONS: Readonly<Record<UnitId, UnitDefinition>> = {
  archer: {
    canAttack: false,
    hasTactic: true,
    tokenCount: 4,
    unitId: 'archer',
  },
  berserker: {
    canAttack: true,
    hasTactic: false,
    tokenCount: 5,
    unitId: 'berserker',
  },
  cavalry: {
    canAttack: true,
    hasTactic: true,
    tokenCount: 4,
    unitId: 'cavalry',
  },
  crossbowman: {
    canAttack: true,
    hasTactic: true,
    tokenCount: 5,
    unitId: 'crossbowman',
  },
  ensign: {
    canAttack: true,
    hasTactic: true,
    tokenCount: 5,
    unitId: 'ensign',
  },
  footman: {
    canAttack: true,
    hasTactic: true,
    tokenCount: 5,
    unitId: 'footman',
  },
  knight: {
    canAttack: true,
    hasTactic: false,
    tokenCount: 4,
    unitId: 'knight',
  },
  lancer: {
    canAttack: false,
    hasTactic: true,
    tokenCount: 4,
    unitId: 'lancer',
  },
  lightCavalry: {
    canAttack: true,
    hasTactic: true,
    tokenCount: 5,
    unitId: 'lightCavalry',
  },
  marshal: {
    canAttack: true,
    hasTactic: true,
    tokenCount: 5,
    unitId: 'marshal',
  },
  mercenary: {
    canAttack: true,
    hasTactic: false,
    tokenCount: 5,
    unitId: 'mercenary',
  },
  pikeman: {
    canAttack: true,
    hasTactic: false,
    tokenCount: 4,
    unitId: 'pikeman',
  },
  royalGuard: {
    canAttack: true,
    hasTactic: true,
    tokenCount: 5,
    unitId: 'royalGuard',
  },
  scout: {
    canAttack: true,
    hasTactic: false,
    tokenCount: 5,
    unitId: 'scout',
  },
  swordsman: {
    canAttack: true,
    hasTactic: false,
    tokenCount: 5,
    unitId: 'swordsman',
  },
  warriorPriest: {
    canAttack: true,
    hasTactic: false,
    tokenCount: 4,
    unitId: 'warriorPriest',
  },
};

export function getUnitDefinition(unitId: UnitId): UnitDefinition {
  return UNIT_DEFINITIONS[unitId];
}
