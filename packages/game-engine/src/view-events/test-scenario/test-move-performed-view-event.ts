import { NullableGameViewError } from '../../errors/nullable-game-view-error.js';
import { type GameView, cloneJsonValue } from '../../state.js';
import type { TestMovePerformedViewEventData } from '../../view-events.js';
import type { ApplicableViewEvent } from '../applicable-view-event.js';

// eslint-disable-next-line max-len
export class TestMovePerformedViewEvent implements ApplicableViewEvent<TestMovePerformedViewEventData> {
  private constructor(readonly data: TestMovePerformedViewEventData) {}

  static fromData(
    data: TestMovePerformedViewEventData
  ): TestMovePerformedViewEvent {
    if ('privateData' in data.payload) {
      return new TestMovePerformedViewEvent({
        ...data,
        payload: {
          ...data.payload,
          privateData: cloneJsonValue(data.payload.privateData),
        },
      });
    }

    return new TestMovePerformedViewEvent({
      ...data,
      payload: { ...data.payload },
    });
  }

  apply(view: GameView | null): GameView {
    if (view === null) {
      throw new NullableGameViewError();
    }

    return {
      ...view,
      currentPlayerId: this.data.payload.nextPlayerId,
      lastEventSequence: this.data.sequence,
      moveCount: this.data.payload.moveNumber,
      players: view.players.map((player) => {
        if (player.id !== this.data.payload.playerId) {
          return player;
        }

        return { ...player, moveCount: player.moveCount + 1 };
      }),
      privateMoves:
        'privateData' in this.data.payload
          ? [
              ...view.privateMoves,
              {
                data: cloneJsonValue(this.data.payload.privateData),
                moveNumber: this.data.payload.moveNumber,
              },
            ]
          : view.privateMoves,
    };
  }

  toData(): TestMovePerformedViewEventData {
    if ('privateData' in this.data.payload) {
      return {
        ...this.data,
        payload: {
          ...this.data.payload,
          privateData: cloneJsonValue(this.data.payload.privateData),
        },
      };
    }

    return {
      ...this.data,
      payload: { ...this.data.payload },
    };
  }
}
