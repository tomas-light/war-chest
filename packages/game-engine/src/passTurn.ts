import { advanceTurn } from './advanceTurn.js';
import { type BattlefieldState, cloneBattlefield } from './Battlefield.js';
import { cloneGameCoin } from './GameCoin.js';
import type { GameState } from './state.js';

interface Input {
  coinIndex: number;
  playerId: string;
  state: GameState;
}

export interface PassTurnResult {
  battlefield: BattlefieldState;
  nextPlayerId: string;
}

export function passTurn(input: Input): PassTurnResult | null {
  if (input.state.battlefield === null) {
    return null;
  }

  const battlefield = cloneBattlefield(input.state.battlefield);
  const resources = battlefield.playerResources.find(
    (item) => item.playerId === input.playerId
  );
  const selectedCoin = resources?.hand.at(input.coinIndex);

  if (resources === undefined || selectedCoin === undefined) {
    return null;
  }

  resources.hand.splice(input.coinIndex, 1);
  resources.discard.push({
    coin: cloneGameCoin(selectedCoin),
    faceUp: false,
  });

  const nextPlayerId = advanceTurn({
    battlefield,
    playerId: input.playerId,
    state: input.state,
  });

  if (nextPlayerId === null) {
    return null;
  }

  return { battlefield, nextPlayerId };
}
