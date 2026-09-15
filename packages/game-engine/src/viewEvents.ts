import type { RuntimeFeatureFlags } from '@war-chest/feature-flags';
import type {
  CardSelectionAction,
  CardSelectionPhase,
  GameStartSelection,
} from './CardSelection.js';
import type { GAME_EVENT_VERSION, GAME_RULES_VERSION } from './events.js';
import type { GamePreparationSettings, GameSettings } from './GameSettings.js';
import type { GameTeam, JsonValue } from './state.js';
import type { UnitId } from './UnitId.js';

interface EventMetadata {
  sequence: number;
  version: typeof GAME_EVENT_VERSION;
}

export interface GameCreatedViewEventData extends EventMetadata {
  payload: {
    creatorId: string;
    featureFlags: RuntimeFeatureFlags;
    rulesVersion: typeof GAME_RULES_VERSION;
    settings: GameSettings;
  };
  type: 'GameCreated';
}

export interface GameSettingsUpdatedViewEventData extends EventMetadata {
  payload: GamePreparationSettings;
  type: 'GameSettingsUpdated';
}

export interface PlayerJoinedViewEventData extends EventMetadata {
  payload: {
    playerId: string;
    seat: number;
    team: GameTeam;
  };
  type: 'PlayerJoined';
}

export interface PlayerLeftViewEventData extends EventMetadata {
  payload: {
    playerId: string;
  };
  type: 'PlayerLeft';
}

export interface PlayerPositionChangedViewEventData extends EventMetadata {
  payload: {
    playerId: string;
    seat: number;
    team: GameTeam;
  };
  type: 'PlayerPositionChanged';
}

export interface PlayerPositionsSwappedViewEventData extends EventMetadata {
  payload: {
    positions: [
      { playerId: string; seat: number; team: GameTeam },
      { playerId: string; seat: number; team: GameTeam },
    ];
  };
  type: 'PlayerPositionsSwapped';
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
    reason: 'disconnectTimeout' | 'surrender';
  };
  type: 'PlayerDefeated';
}

export interface GameStartedViewEventData extends EventMetadata {
  payload: {
    firstPlayerId: string;
  };
  type: 'GameStarted';
}

export interface CardsPreparedViewEventData extends EventMetadata {
  payload: {
    playerOrder: readonly string[];
    selection: GameStartSelection;
  };
  type: 'CardsPrepared';
}

export interface CardChoiceConfirmedViewEventData extends EventMetadata {
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

export interface CardSelectionCompletedViewEventData extends EventMetadata {
  payload: Record<string, never>;
  type: 'CardSelectionCompleted';
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
  | CardChoiceConfirmedViewEventData
  | CardSelectionCompletedViewEventData
  | CardsPreparedViewEventData
  | GameCreatedViewEventData
  | GameFinishedViewEventData
  | GameSettingsUpdatedViewEventData
  | GameStartedViewEventData
  | PlayerDefeatedViewEventData
  | PlayerDisconnectedViewEventData
  | PlayerJoinedViewEventData
  | PlayerLeftViewEventData
  | PlayerPositionChangedViewEventData
  | PlayerPositionsSwappedViewEventData
  | PlayerReconnectedViewEventData
  | TestMovePerformedViewEventData
  | ViewSequenceAdvancedEventData;
