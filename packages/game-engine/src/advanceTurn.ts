import type { BattlefieldState } from './Battlefield.js';
import type { GameState } from './state.js';

interface Input {
  battlefield: BattlefieldState;
  playerId: string;
  state: GameState;
}

export function advanceTurn(input: Input): string | null {
  if (
    input.battlefield.playerResources.every((item) => item.hand.length === 0)
  ) {
    input.battlefield.round += 1;

    for (const resources of input.battlefield.playerResources) {
      drawHand(resources);
    }

    return input.state.initiativePlayerId;
  }

  const players = [...input.state.players].sort(
    (first, second) => first.seat - second.seat
  );
  const currentPlayerIndex = players.findIndex(
    (player) => player.id === input.playerId
  );

  if (currentPlayerIndex < 0) {
    return null;
  }

  for (let offset = 1; offset <= players.length; offset += 1) {
    const playerIndex = (currentPlayerIndex + offset) % players.length;
    const player = players.at(playerIndex);
    const resources = input.battlefield.playerResources.find(
      (item) => item.playerId === player?.id
    );

    if (
      player !== undefined &&
      resources !== undefined &&
      resources.hand.length > 0
    ) {
      return player.id;
    }
  }

  return null;
}

function drawHand(
  resources: BattlefieldState['playerResources'][number]
): void {
  while (resources.hand.length < 3) {
    if (resources.bag.length === 0) {
      resources.bag = shuffle(
        resources.discard.map((discardedCoin) => discardedCoin.coin)
      );
      resources.discard = [];
    }

    const coin = resources.bag.shift();

    if (coin === undefined) {
      return;
    }

    resources.hand.push(coin);
  }
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
