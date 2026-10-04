import { getUnitActionStrategy } from './getUnitActionStrategy.js';
import type { UnitTacticInput } from './UnitTacticInput.js';
import type { UnitTacticOptions } from './UnitTacticOptions.js';

export function getUnitTacticOptions(
  input: UnitTacticInput
): UnitTacticOptions | null {
  const { coinIndex, game, playerId } = input;
  const battlefield = game.battlefield;

  if (
    battlefield === null ||
    game.status !== 'active' ||
    game.settings.format !== 'duel' ||
    game.currentPlayerId !== playerId ||
    !Number.isInteger(coinIndex) ||
    coinIndex < 0
  ) {
    return null;
  }

  const coin = battlefield.playerResources
    .find((resources) => resources.playerId === playerId)
    ?.hand?.at(coinIndex);

  if (coin?.kind !== 'unit') {
    return null;
  }

  return getUnitActionStrategy(coin.unitId)?.getTacticOptions(input) ?? null;
}
