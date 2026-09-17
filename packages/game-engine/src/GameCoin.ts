import type { UnitId } from './UnitId.js';

export type RoyalCoin = {
  kind: 'royal';
};

export type UnitCoin = {
  kind: 'unit';
  unitId: UnitId;
};

export type GameCoin = RoyalCoin | UnitCoin;

export type DiscardedCoin = {
  coin: GameCoin;
  faceUp: boolean;
};

export type GameViewDiscardedCoin = {
  coin: GameCoin | null;
  faceUp: boolean;
};

export function cloneGameCoin(coin: GameCoin): GameCoin {
  return { ...coin };
}

export function cloneDiscardedCoin(coin: DiscardedCoin): DiscardedCoin {
  return {
    coin: cloneGameCoin(coin.coin),
    faceUp: coin.faceUp,
  };
}
