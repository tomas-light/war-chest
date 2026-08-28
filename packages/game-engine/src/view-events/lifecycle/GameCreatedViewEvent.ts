import type { GameView } from '../../state.js';
import type { GameCreatedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

const DUPLICATE_GAME_CREATED_MESSAGE =
  'GameCreated cannot be applied to an existing game view';

// eslint-disable-next-line max-len
export class GameCreatedViewEvent implements ApplicableViewEvent<GameCreatedViewEventData> {
  private constructor(readonly data: GameCreatedViewEventData) {}

  static fromData(data: GameCreatedViewEventData): GameCreatedViewEvent {
    return new GameCreatedViewEvent({
      ...data,
      payload: {
        ...data.payload,
        featureFlags: { ...data.payload.featureFlags },
      },
    });
  }

  apply(view: GameView | null): GameView {
    if (view !== null) {
      throw new Error(DUPLICATE_GAME_CREATED_MESSAGE);
    }

    return {
      creatorId: this.data.payload.creatorId,
      currentPlayerId: null,
      featureFlags: { ...this.data.payload.featureFlags },
      lastEventSequence: this.data.sequence,
      moveCount: 0,
      players: [],
      privateMoves: [],
      rulesVersion: this.data.payload.rulesVersion,
      status: 'waiting',
      teams: { black: [], white: [] },
      winnerTeam: null,
    };
  }

  toData(): GameCreatedViewEventData {
    return {
      ...this.data,
      payload: {
        ...this.data.payload,
        featureFlags: { ...this.data.payload.featureFlags },
      },
    };
  }
}
