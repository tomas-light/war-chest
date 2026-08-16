export type JsonValue =
  boolean | number | string | null | { [key: string]: JsonValue } | JsonValue[];

export type FeatureFlags = Readonly<Record<string, boolean>>;
export type GameStatus = 'waiting' | 'active' | 'finished';
export type GameTeam = 'black' | 'white';

export interface GameTeams {
  black: readonly string[];
  white: readonly string[];
}

export interface GamePlayer {
  id: string;
  moveCount: number;
  privateMoves: readonly PrivateMove[];
  seat: number;
  team: GameTeam;
}

export interface GameState {
  currentPlayerId: string | null;
  featureFlags: FeatureFlags;
  lastEventSequence: number;
  moveCount: number;
  players: readonly GamePlayer[];
  rulesVersion: number;
  status: GameStatus;
  teams: GameTeams;
  winnerTeam: GameTeam | null;
}

export interface GameViewPlayer {
  id: string;
  moveCount: number;
  seat: number;
  team: GameTeam;
}

export interface PrivateMove {
  data: JsonValue;
  moveNumber: number;
}

export interface GameView {
  currentPlayerId: string | null;
  featureFlags: FeatureFlags;
  lastEventSequence: number;
  moveCount: number;
  players: readonly GameViewPlayer[];
  privateMoves: readonly PrivateMove[];
  rulesVersion: number;
  status: GameStatus;
  teams: GameTeams;
  winnerTeam: GameTeam | null;
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

export function cloneGameTeams(teams: GameTeams): GameTeams {
  return {
    black: [...teams.black],
    white: [...teams.white],
  };
}
