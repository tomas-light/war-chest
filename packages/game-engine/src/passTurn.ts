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

  if (battlefield.playerResources.every((item) => item.hand.length === 0)) {
    startNextRound(battlefield);

    if (input.state.initiativePlayerId === null) {
      return null;
    }

    return {
      battlefield,
      nextPlayerId: input.state.initiativePlayerId,
    };
  }

  const nextPlayerId = findNextPlayerId({
    battlefield,
    playerId: input.playerId,
    state: input.state,
  });

  if (nextPlayerId === null) {
    return null;
  }

  return { battlefield, nextPlayerId };
}

function startNextRound(battlefield: BattlefieldState): void {
  battlefield.round += 1;

  for (const resources of battlefield.playerResources) {
    drawHand(resources);
  }
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

interface FindNextPlayerIdInput {
  battlefield: BattlefieldState;
  playerId: string;
  state: GameState;
}

function findNextPlayerId(input: FindNextPlayerIdInput): string | null {
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
