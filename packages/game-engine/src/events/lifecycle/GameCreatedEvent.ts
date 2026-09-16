import type { GameCreatedEventData } from '../../events.js';
import { cloneGameSettings } from '../../GameSettings.js';
import type { GameState } from '../../state.js';
import type { GameCreatedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

const DUPLICATE_GAME_CREATED_MESSAGE =
  'GameCreated cannot be applied to an existing game';

export class GameCreatedEvent implements ApplicableEvent<GameCreatedEventData> {
  private constructor(readonly data: GameCreatedEventData) {}

  static fromData(data: GameCreatedEventData): GameCreatedEvent {
    return new GameCreatedEvent({
      ...data,
      payload: {
        ...data.payload,
        featureFlags: { ...data.payload.featureFlags },
        settings: cloneGameSettings(data.payload.settings),
      },
    });
  }

  apply(state: GameState | null): GameState {
    if (state !== null) {
      throw new Error(DUPLICATE_GAME_CREATED_MESSAGE);
    }

    return {
      battlefield: null,
      cardSelection: null,
      creatorId: this.data.payload.creatorId,
      currentPlayerId: null,
      featureFlags: { ...this.data.payload.featureFlags },
      firstPlayerId: null,
      initiativePlayerId: null,
      lastEventSequence: this.data.sequence,
      moveCount: 0,
      players: [],
      rulesVersion: this.data.payload.rulesVersion,
      settings: cloneGameSettings(this.data.payload.settings),
      status: 'waiting',
      teams: { black: [], white: [] },
      winnerTeam: null,
    };
  }

  toData(): GameCreatedEventData {
    return {
      ...this.data,
      payload: {
        ...this.data.payload,
        featureFlags: { ...this.data.payload.featureFlags },
        settings: cloneGameSettings(this.data.payload.settings),
      },
    };
  }

  toViewData(): GameCreatedViewEventData {
    return this.toData();
  }
}
