import type { GAME_EVENT_VERSION, GAME_RULES_VERSION } from './events.js';
import type { FeatureFlags, GameTeam, JsonValue } from './state.js';

interface EventMetadata {
  sequence: number;
  version: typeof GAME_EVENT_VERSION;
}

export interface GameCreatedViewEventData extends EventMetadata {
  payload: {
    featureFlags: FeatureFlags;
    rulesVersion: typeof GAME_RULES_VERSION;
  };
  type: 'GameCreated';
}

export interface PlayerJoinedViewEventData extends EventMetadata {
  payload: {
    playerId: string;
    seat: number;
    team: GameTeam;
  };
  type: 'PlayerJoined';
}

export interface PlayerDisconnectedViewEventData extends EventMetadata {
  payload: {
    playerId: string;
    reconnectDeadline: string;
  };
  type: 'PlayerDisconnected';
}

export interface PlayerReconnectedViewEventData extends EventMetadata {
  payload: {
    playerId: string;
  };
  type: 'PlayerReconnected';
}

export interface PlayerDefeatedViewEventData extends EventMetadata {
  payload: {
    playerId: string;
    reason: 'disconnectTimeout';
  };
  type: 'PlayerDefeated';
}

export interface GameStartedViewEventData extends EventMetadata {
  payload: {
    firstPlayerId: string;
  };
  type: 'GameStarted';
}

interface PublicTestMoveData {
  moveNumber: number;
  nextPlayerId: string;
  playerId: string;
}

export interface PublicTestMovePerformedViewEventData extends EventMetadata {
  payload: PublicTestMoveData;
  type: 'TestMovePerformed';
}

export interface PrivateTestMovePerformedViewEventData extends EventMetadata {
  payload: PublicTestMoveData & {
    privateData: JsonValue;
  };
  type: 'TestMovePerformed';
}

export interface GameFinishedViewEventData extends EventMetadata {
  payload: {
    winnerTeam: GameTeam;
  };
  type: 'GameFinished';
}

export interface ViewSequenceAdvancedEventData extends EventMetadata {
  type: 'ViewSequenceAdvanced';
}

export type TestMovePerformedViewEventData =
  PrivateTestMovePerformedViewEventData | PublicTestMovePerformedViewEventData;

export type GameViewEventData =
  | GameCreatedViewEventData
  | GameFinishedViewEventData
  | GameStartedViewEventData
  | PlayerDefeatedViewEventData
  | PlayerDisconnectedViewEventData
  | PlayerJoinedViewEventData
  | PlayerReconnectedViewEventData
  | TestMovePerformedViewEventData
  | ViewSequenceAdvancedEventData;
