import type { FeatureFlags } from '../state.js';

export interface CreateGameCommandData {
  featureFlags: FeatureFlags;
  type: 'CreateGame';
}

export interface JoinGameCommandData {
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
