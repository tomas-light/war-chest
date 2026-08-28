import type { RuntimeFeatureFlags } from '@war-chest/feature-flags';
import type { GameTeam } from '../state.js';

export interface CreateGameCommandData {
  creatorId: string;
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

export interface SwapPlayerPositionsCommandData {
  type: 'SwapPlayerPositions';
}

export interface FinishGameCommandData {
  type: 'FinishGame';
}

export type LifecycleCommandData =
  | FinishGameCommandData
  | JoinGameCommandData
  | StartGameCommandData
  | SwapPlayerPositionsCommandData;
