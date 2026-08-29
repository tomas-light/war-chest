import type { RuntimeFeatureFlags } from '@war-chest/feature-flags';
import type { GameTeam, JsonValue } from './state.js';

export const GAME_EVENT_VERSION = 1;
export const GAME_RULES_VERSION = 1;

interface EventMetadata {
  sequence: number;
  version: typeof GAME_EVENT_VERSION;
}

export interface GameCreatedEventData extends EventMetadata {
  payload: {
    creatorId: string;
    featureFlags: RuntimeFeatureFlags;
    rulesVersion: typeof GAME_RULES_VERSION;
  };
  type: 'GameCreated';
}

export interface PlayerJoinedEventData extends EventMetadata {
  payload: {
    playerId: string;
    seat: number;
    team: GameTeam;
  };
  type: 'PlayerJoined';
}

export interface PlayerLeftEventData extends EventMetadata {
  payload: {
    playerId: string;
  };
  type: 'PlayerLeft';
}

export interface PlayerPositionChangedEventData extends EventMetadata {
  payload: {
    playerId: string;
    seat: number;
    team: GameTeam;
  };
  type: 'PlayerPositionChanged';
}

export interface PlayerPositionsSwappedEventData extends EventMetadata {
  payload: {
    positions: [
      { playerId: string; seat: number; team: GameTeam },
      { playerId: string; seat: number; team: GameTeam },
    ];
  };
  type: 'PlayerPositionsSwapped';
}

export interface PlayerDisconnectedEventData extends EventMetadata {
  payload: {
    playerId: string;
    reconnectDeadline: string;
  };
  type: 'PlayerDisconnected';
}

export interface PlayerReconnectedEventData extends EventMetadata {
  payload: {
    playerId: string;
  };
  type: 'PlayerReconnected';
}

export interface PlayerDefeatedEventData extends EventMetadata {
  payload: {
    playerId: string;
    reason: 'disconnectTimeout' | 'surrender';
  };
  type: 'PlayerDefeated';
}

export interface GameStartedEventData extends EventMetadata {
  payload: {
    firstPlayerId: string;
  };
  type: 'GameStarted';
}

export interface TestMovePerformedEventData extends EventMetadata {
  payload: {
    moveNumber: number;
    nextPlayerId: string;
    playerId: string;
    privateData: JsonValue;
  };
  type: 'TestMovePerformed';
}

export interface GameFinishedEventData extends EventMetadata {
  payload: {
    winnerTeam: GameTeam;
  };
  type: 'GameFinished';
}

export type GameEventData =
  | GameCreatedEventData
  | GameFinishedEventData
  | GameStartedEventData
  | PlayerDefeatedEventData
  | PlayerDisconnectedEventData
  | PlayerJoinedEventData
  | PlayerLeftEventData
  | PlayerPositionChangedEventData
  | PlayerPositionsSwappedEventData
  | PlayerReconnectedEventData
  | TestMovePerformedEventData;
