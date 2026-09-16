import { describe, expect, test } from 'vitest';
import { getUnitDefinition } from '../src/UnitDefinition.js';

describe('unit definitions', () => {
  test('stores the token count printed on every unit card', () => {
    expect({
      archer: getUnitDefinition('archer').tokenCount,
      berserker: getUnitDefinition('berserker').tokenCount,
      cavalry: getUnitDefinition('cavalry').tokenCount,
      crossbowman: getUnitDefinition('crossbowman').tokenCount,
      ensign: getUnitDefinition('ensign').tokenCount,
      footman: getUnitDefinition('footman').tokenCount,
      knight: getUnitDefinition('knight').tokenCount,
      lancer: getUnitDefinition('lancer').tokenCount,
      lightCavalry: getUnitDefinition('lightCavalry').tokenCount,
      marshal: getUnitDefinition('marshal').tokenCount,
      mercenary: getUnitDefinition('mercenary').tokenCount,
      pikeman: getUnitDefinition('pikeman').tokenCount,
      royalGuard: getUnitDefinition('royalGuard').tokenCount,
      scout: getUnitDefinition('scout').tokenCount,
      swordsman: getUnitDefinition('swordsman').tokenCount,
      warriorPriest: getUnitDefinition('warriorPriest').tokenCount,
    }).toEqual({
      archer: 4,
      berserker: 5,
      cavalry: 4,
      crossbowman: 5,
      ensign: 5,
      footman: 5,
      knight: 4,
      lancer: 4,
      lightCavalry: 5,
      marshal: 5,
      mercenary: 5,
      pikeman: 4,
      royalGuard: 5,
      scout: 5,
      swordsman: 5,
      warriorPriest: 4,
    });
  });
});
