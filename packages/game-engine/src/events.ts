import type { FeatureFlags, JsonValue } from './state.js';

export const GAME_EVENT_VERSION = 1;
export const GAME_RULES_VERSION = 1;

interface EventMetadata {
  sequence: number;
  version: typeof GAME_EVENT_VERSION;
}

export interface GameCreatedEventData extends EventMetadata {
  payload: {
    featureFlags: FeatureFlags;
    rulesVersion: typeof GAME_RULES_VERSION;
  };
  type: 'GameCreated';
}

export interface PlayerJoinedEventData extends EventMetadata {
  payload: {
    playerId: string;
    seat: number;
  };
  type: 'PlayerJoined';
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
    finishedByPlayerId: string;
  };
  type: 'GameFinished';
}

export type GameEventData =
  | GameCreatedEventData
  | GameFinishedEventData
  | GameStartedEventData
  | PlayerJoinedEventData
  | TestMovePerformedEventData;
