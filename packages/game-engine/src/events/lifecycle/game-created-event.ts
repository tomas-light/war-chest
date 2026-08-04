import type { GameCreatedEventData } from '../../events.js';
import type { GameState } from '../../state.js';
import type { GameCreatedViewEventData } from '../../view-events.js';
import type { ApplicableEvent } from '../applicable-event.js';

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
      },
    });
  }

  apply(state: GameState | null): GameState {
    if (state !== null) {
      throw new Error(DUPLICATE_GAME_CREATED_MESSAGE);
    }

    return {
      currentPlayerId: null,
      featureFlags: { ...this.data.payload.featureFlags },
      lastEventSequence: this.data.sequence,
      moveCount: 0,
      players: [],
      rulesVersion: this.data.payload.rulesVersion,
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
      },
    };
  }

  toViewData(): GameCreatedViewEventData {
    return this.toData();
  }
}
