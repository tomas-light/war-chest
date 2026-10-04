import {
  type BattlefieldState,
  type CellId,
  type GameViewBattlefieldState,
  getBattlefieldLayout,
} from './Battlefield.js';
import type { GameCoin } from './GameCoin.js';
import { getUnitActionStrategy } from './getUnitActionStrategy.js';
import type { GameState, GameView } from './state.js';
import type { UnitId } from './UnitId.js';

export interface TurnActionOptions {
  deployedUnitIds: readonly string[];
  deployCells: readonly CellId[];
  moves: readonly UnitMoveOptions[];
  recruitUnits: readonly UnitId[];
}

interface UnitMoveOptions {
  battlefieldUnitId: string;
  cellIds: readonly CellId[];
}

type ReadableGame = Pick<
  GameState | GameView,
  'battlefield' | 'currentPlayerId' | 'players' | 'settings' | 'status'
>;

type ReadableBattlefield = BattlefieldState | GameViewBattlefieldState;

export function getTurnActionOptions(
  game: ReadableGame,
  playerId: string,
  coinIndex: number
): TurnActionOptions {
  const emptyOptions: TurnActionOptions = {
    deployedUnitIds: [],
    deployCells: [],
    moves: [],
    recruitUnits: [],
  };

  if (
    game.status !== 'active' ||
    game.settings.format !== 'duel' ||
    game.currentPlayerId !== playerId ||
    game.battlefield === null ||
    !Number.isInteger(coinIndex) ||
    coinIndex < 0
  ) {
    return emptyOptions;
  }

  const battlefield: ReadableBattlefield = game.battlefield;
  const resources = battlefield.playerResources.find(
    (item) => item.playerId === playerId
  );
  const selectedCoin: GameCoin | undefined = resources?.hand?.at(coinIndex);

  if (selectedCoin === undefined) {
    return emptyOptions;
  }

  const recruitUnits =
    resources?.supply
      .filter(
        (item) => item.count > 0 && getUnitActionStrategy(item.unitId) !== null
      )
      .map((item) => item.unitId) ?? [];

  if (selectedCoin.kind === 'royal') {
    return { ...emptyOptions, recruitUnits };
  }

  const deployedUnits = battlefield.units.filter(
    (unit) => unit.ownerId === playerId && unit.unitId === selectedCoin.unitId
  );
  const deployedUnitIds = deployedUnits.map((unit) => unit.id);
  const strategy = getUnitActionStrategy(selectedCoin.unitId);

  if (strategy === null) {
    return { ...emptyOptions, deployedUnitIds, recruitUnits };
  }

  const layout = getBattlefieldLayout(game.settings.format);
  const moves = deployedUnits
    .map((unit) => ({
      battlefieldUnitId: unit.id,
      cellIds: layout.cells
        .filter(
          (cell) =>
            isAdjacentCell(unit.cellId, cell.cellId) &&
            !battlefield.units.some((other) => other.cellId === cell.cellId)
        )
        .map((cell) => cell.cellId),
    }))
    .filter((move) => move.cellIds.length > 0);

  const player = game.players.find((item) => item.id === playerId);

  if (player === undefined) {
    return emptyOptions;
  }

  const canDeploy = strategy.canDeploy(battlefield.units, playerId);
  const deployCells = battlefield.controlPoints
    .filter(
      (point) =>
        canDeploy &&
        point.ownerTeam === player.team &&
        !battlefield.units.some((unit) => unit.cellId === point.cellId)
    )
    .map((point) => point.cellId);

  return { deployedUnitIds, deployCells, moves, recruitUnits };
}

function isAdjacentCell(source: CellId, target: CellId): boolean {
  const columnDelta = target.charCodeAt(0) - source.charCodeAt(0);
  const rowDelta = Number(target.slice(1)) - Number(source.slice(1));

  return (
    (columnDelta === 0 && Math.abs(rowDelta) === 1) ||
    (rowDelta === 0 && Math.abs(columnDelta) === 1) ||
    (columnDelta === rowDelta && Math.abs(columnDelta) === 1)
  );
}
