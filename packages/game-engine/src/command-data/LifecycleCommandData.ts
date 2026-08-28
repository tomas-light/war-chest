import type { RuntimeFeatureFlags } from '@war-chest/feature-flags';
import type { GameTeam } from '../state.js';

export interface CreateGameCommandData {
  featureFlags: RuntimeFeatureFlags;
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
