import type { GameFormat } from './GameSettings.js';
import type { GamePlayer, GameTeam } from './state.js';
import { getUnitDefinition } from './UnitDefinition.js';
import type { UnitId } from './UnitId.js';

export const DUEL_CELL_IDS = [
  'A1',
  'A2',
  'A3',
  'A4',
  'B1',
  'B2',
  'B3',
  'B4',
  'B5',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'D1',
  'D2',
  'D3',
  'D4',
  'D5',
  'D6',
  'D7',
  'E2',
  'E3',
  'E4',
  'E5',
  'E6',
  'E7',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'G4',
  'G5',
  'G6',
  'G7',
] as const;

export const TEAM_CELL_IDS = [
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
  'A6',
  'B1',
  'B2',
  'B3',
  'B4',
  'B5',
  'B6',
  'B7',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
  'D1',
  'D2',
  'D3',
  'D4',
  'D5',
  'D6',
  'D7',
  'E1',
  'E2',
  'E3',
  'E4',
  'E5',
  'E6',
  'E7',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'G2',
  'G3',
  'G4',
  'G5',
  'G6',
  'G7',
] as const;

export type CellId = (typeof TEAM_CELL_IDS)[number];

export type BattlefieldControlPoint = {
  cellId: CellId;
  fortified: boolean;
  ownerTeam: GameTeam | null;
};

export type BattlefieldUnit = {
  bolstered: number;
  cellId: CellId;
  id: string;
  ownerId: string;
  unitId: UnitId;
};

export type PlayerUnitSupply = {
  count: number;
  total: number;
  unitId: UnitId;
};

export type PlayerBattlefieldResources = {
  bag: UnitId[];
  eliminated: UnitId[];
  hand: UnitId[];
  playerId: string;
  supply: PlayerUnitSupply[];
};

export type BattlefieldState = {
  controlPoints: BattlefieldControlPoint[];
  playerResources: PlayerBattlefieldResources[];
  units: BattlefieldUnit[];
};

export interface GameViewPlayerBattlefieldResources {
  bagCount: number | null;
  eliminated: readonly UnitId[];
  hand: readonly UnitId[] | null;
  handCount: number;
  playerId: string;
  supply: readonly PlayerUnitSupply[];
}

export interface GameViewBattlefieldState {
  controlPoints: readonly BattlefieldControlPoint[];
  playerResources: readonly GameViewPlayerBattlefieldResources[];
  units: readonly BattlefieldUnit[];
}

export type BattlefieldCellKind = 'controlPoint' | 'ground';

export type BattlefieldCellZone = 'core' | 'team';

export interface BattlefieldLayoutCell {
  cellId: CellId;
  kind: BattlefieldCellKind;
  zone: BattlefieldCellZone;
}

export interface BattlefieldLayout {
  cells: readonly BattlefieldLayoutCell[];
  format: GameFormat;
}

interface CreateInitialBattlefieldInput {
  format: GameFormat;
  players: readonly GamePlayer[];
}

const DUEL_CONTROL_POINTS: readonly BattlefieldControlPoint[] = [
  createControlPoint('F7', 'black'),
  createControlPoint('G5', 'black'),
  createControlPoint('D6', null),
  createControlPoint('E4', null),
  createControlPoint('F3', null),
  createControlPoint('B5', null),
  createControlPoint('C4', null),
  createControlPoint('D2', null),
  createControlPoint('A3', 'white'),
  createControlPoint('B1', 'white'),
];

const TEAM_CONTROL_POINTS: readonly BattlefieldControlPoint[] = [
  createControlPoint('F7', 'black'),
  createControlPoint('G5', 'black'),
  createControlPoint('C7', null),
  createControlPoint('D6', null),
  createControlPoint('E4', null),
  createControlPoint('F3', null),
  createControlPoint('G2', null),
  createControlPoint('A6', null),
  createControlPoint('B5', null),
  createControlPoint('C4', null),
  createControlPoint('D2', null),
  createControlPoint('E1', null),
  createControlPoint('A3', 'white'),
  createControlPoint('B1', 'white'),
];

const TEAM_ZONE_CELL_IDS: readonly CellId[] = [
  'A5',
  'A6',
  'B6',
  'B7',
  'F1',
  'F2',
  'G2',
  'G3',
];

export function getBattlefieldLayout(format: GameFormat): BattlefieldLayout {
  const cellIds = format === 'duel' ? DUEL_CELL_IDS : TEAM_CELL_IDS;
  const controlPoints =
    format === 'duel' ? DUEL_CONTROL_POINTS : TEAM_CONTROL_POINTS;
  const controlPointCellIds = new Set(
    controlPoints.map((controlPoint) => controlPoint.cellId)
  );
  const teamCellIds = new Set(TEAM_ZONE_CELL_IDS);
  const cells: BattlefieldLayoutCell[] = cellIds.map((cellId) => {
    let kind: BattlefieldCellKind = 'ground';
    let zone: BattlefieldCellZone = 'core';

    if (controlPointCellIds.has(cellId)) {
      kind = 'controlPoint';
    }

    if (format === 'team' && teamCellIds.has(cellId)) {
      zone = 'team';
    }

    return { cellId, kind, zone };
  });

  return { cells, format };
}

export function createInitialBattlefield(
  input: CreateInitialBattlefieldInput
): BattlefieldState {
  const controlPoints =
    input.format === 'duel' ? DUEL_CONTROL_POINTS : TEAM_CONTROL_POINTS;

  return {
    controlPoints: controlPoints.map((point) => ({ ...point })),
    playerResources: input.players.map((player) =>
      createInitialPlayerResources(player)
    ),
    units: [],
  };
}

export function cloneBattlefield(
  battlefield: BattlefieldState
): BattlefieldState {
  return {
    controlPoints: battlefield.controlPoints.map((point) => ({ ...point })),
    playerResources: battlefield.playerResources.map((resources) => ({
      bag: [...resources.bag],
      eliminated: [...resources.eliminated],
      hand: [...resources.hand],
      playerId: resources.playerId,
      supply: resources.supply.map((item) => ({ ...item })),
    })),
    units: battlefield.units.map((unit) => ({ ...unit })),
  };
}

function createControlPoint(
  cellId: CellId,
  ownerTeam: GameTeam | null
): BattlefieldControlPoint {
  return { cellId, fortified: false, ownerTeam };
}

function createInitialPlayerResources(
  player: GamePlayer
): PlayerBattlefieldResources {
  const bag = shuffle(player.cardIds.flatMap((unitId) => [unitId, unitId]));
  const hand = bag.slice(0, 3);

  return {
    bag: bag.slice(3),
    eliminated: [],
    hand,
    playerId: player.id,
    supply: player.cardIds.map((unitId) => {
      const definition = getUnitDefinition(unitId);

      return {
        count: definition.tokenCount - 2,
        total: definition.tokenCount,
        unitId,
      };
    }),
  };
}

function shuffle<Value>(values: readonly Value[]): Value[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [
      result[randomIndex] as Value,
      result[index] as Value,
    ];
  }

  return result;
}
