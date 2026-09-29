import type {
  BattlefieldState,
  CellId,
  GameViewBattlefieldState,
} from './Battlefield.js';
import type { GameCoin } from './GameCoin.js';
import { getUnitActionStrategy } from './getUnitActionStrategy.js';
import type { GameState, GameView } from './state.js';
import type { UnitId } from './UnitId.js';

export interface TurnActionOptions {
  deployCells: readonly CellId[];
  recruitUnits: readonly UnitId[];
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
  const emptyOptions: TurnActionOptions = { deployCells: [], recruitUnits: [] };

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
    return { deployCells: [], recruitUnits };
  }

  const strategy = getUnitActionStrategy(selectedCoin.unitId);

  if (strategy === null || !strategy.canDeploy(battlefield.units, playerId)) {
    return { deployCells: [], recruitUnits };
  }

  const player = game.players.find((item) => item.id === playerId);

  if (player === undefined) {
    return emptyOptions;
  }

  const deployCells = battlefield.controlPoints
    .filter(
      (point) =>
        point.ownerTeam === player.team &&
        !battlefield.units.some((unit) => unit.cellId === point.cellId)
    )
    .map((point) => point.cellId);

  return { deployCells, recruitUnits };
}
