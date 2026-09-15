import type { RuntimeFeatureFlags } from '@war-chest/feature-flags';
import type {
  CardSelectionAction,
  CardSelectionPhase,
  GameStartSelection,
} from './CardSelection.js';
import type { GamePreparationSettings, GameSettings } from './GameSettings.js';
import type { GameTeam, JsonValue } from './state.js';
import type { UnitId } from './UnitId.js';

export const GAME_EVENT_VERSION = 2;
export const GAME_RULES_VERSION = 2;

interface EventMetadata {
  sequence: number;
  version: typeof GAME_EVENT_VERSION;
}

export interface GameCreatedEventData extends EventMetadata {
  payload: {
    creatorId: string;
    featureFlags: RuntimeFeatureFlags;
    rulesVersion: typeof GAME_RULES_VERSION;
    settings: GameSettings;
  };
  type: 'GameCreated';
}

export interface GameSettingsUpdatedEventData extends EventMetadata {
  payload: GamePreparationSettings;
  type: 'GameSettingsUpdated';
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

export interface CardsPreparedEventData extends EventMetadata {
  payload: {
    playerOrder: readonly string[];
    selection: GameStartSelection;
  };
  type: 'CardsPrepared';
}

export interface CardChoiceConfirmedEventData extends EventMetadata {
  payload: {
    action: CardSelectionAction;
    isComplete: boolean;
    nextPhase: CardSelectionPhase;
    nextPlayerId: string | null;
    playerId: string;
    unitId: UnitId;
  };
  type: 'CardChoiceConfirmed';
}

export interface CardSelectionCompletedEventData extends EventMetadata {
  payload: Record<string, never>;
  type: 'CardSelectionCompleted';
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
  | CardChoiceConfirmedEventData
  | CardSelectionCompletedEventData
  | CardsPreparedEventData
  | GameCreatedEventData
  | GameFinishedEventData
  | GameSettingsUpdatedEventData
  | GameStartedEventData
  | PlayerDefeatedEventData
  | PlayerDisconnectedEventData
  | PlayerJoinedEventData
  | PlayerLeftEventData
  | PlayerPositionChangedEventData
  | PlayerPositionsSwappedEventData
  | PlayerReconnectedEventData
  | TestMovePerformedEventData;
