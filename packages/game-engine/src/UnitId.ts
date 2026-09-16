export const UNIT_IDS = [
  'archer',
  'berserker',
  'cavalry',
  'crossbowman',
  'ensign',
  'footman',
  'knight',
  'lancer',
  'lightCavalry',
  'marshal',
  'mercenary',
  'pikeman',
  'royalGuard',
  'scout',
  'swordsman',
  'warriorPriest',
] as const;

export type UnitId = (typeof UNIT_IDS)[number];
