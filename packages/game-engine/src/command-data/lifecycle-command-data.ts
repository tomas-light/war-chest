import type { FeatureFlags, GameTeam } from '../state.js';

export interface CreateGameCommandData {
  featureFlags: FeatureFlags;
  type: 'CreateGame';
}

export interface JoinGameCommandData {
  seat: number;
  team: GameTeam;
  type: 'JoinGame';
}

export interface StartGameCommandData {
  type: 'StartGame';
}

export interface FinishGameCommandData {
  type: 'FinishGame';
}

export type LifecycleCommandData =
  FinishGameCommandData | JoinGameCommandData | StartGameCommandData;
