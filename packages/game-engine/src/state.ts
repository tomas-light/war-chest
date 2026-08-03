export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  JsonPrimitive | { [key: string]: JsonValue } | JsonValue[];

export type FeatureFlags = Readonly<Record<string, JsonPrimitive>>;
export type GameStatus = 'waiting' | 'active' | 'finished';

export interface GamePlayer {
  id: string;
  moveCount: number;
  privateMoves: readonly PrivateMove[];
  seat: number;
}

export interface GameState {
  currentPlayerId: string | null;
  featureFlags: FeatureFlags;
  finishedByPlayerId: string | null;
  lastEventSequence: number;
  moveCount: number;
  players: readonly GamePlayer[];
  rulesVersion: number;
  status: GameStatus;
}

export interface GameViewPlayer {
  id: string;
  moveCount: number;
  seat: number;
}

export interface PrivateMove {
  data: JsonValue;
  moveNumber: number;
}

export interface GameView {
  currentPlayerId: string | null;
  featureFlags: FeatureFlags;
  finishedByPlayerId: string | null;
  lastEventSequence: number;
  moveCount: number;
  players: readonly GameViewPlayer[];
  privateMoves: readonly PrivateMove[];
  rulesVersion: number;
  status: GameStatus;
}

export type Viewer =
  { playerId: string; role: 'player' } | { role: 'spectator' };

export function cloneJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, cloneJsonValue(item)])
    );
  }

  return value;
}
