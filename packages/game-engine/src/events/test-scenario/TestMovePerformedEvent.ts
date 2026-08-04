import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { TestMovePerformedEventData } from '../../events.js';
import { type GameState, type Viewer, cloneJsonValue } from '../../state.js';
import type { TestMovePerformedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

// eslint-disable-next-line max-len
export class TestMovePerformedEvent implements ApplicableEvent<TestMovePerformedEventData> {
  private constructor(readonly data: TestMovePerformedEventData) {}

  static fromData(data: TestMovePerformedEventData): TestMovePerformedEvent {
    return new TestMovePerformedEvent({
      ...data,
      payload: {
        ...data.payload,
        privateData: cloneJsonValue(data.payload.privateData),
      },
    });
  }

  apply(state: GameState | null): GameState {
    if (state === null) {
      throw new NullableGameStateError();
    }

    return {
      ...state,
      currentPlayerId: this.data.payload.nextPlayerId,
      lastEventSequence: this.data.sequence,
      players: state.players.map((player) => {
        if (player.id !== this.data.payload.playerId) {
          return player;
        }

        return {
          ...player,
          moveCount: player.moveCount + 1,
          privateMoves: [
            ...player.privateMoves,
            {
              data: cloneJsonValue(this.data.payload.privateData),
              moveNumber: this.data.payload.moveNumber,
            },
          ],
        };
      }),
      moveCount: this.data.payload.moveNumber,
    };
  }

  toData(): TestMovePerformedEventData {
    return {
      ...this.data,
      payload: {
        ...this.data.payload,
        privateData: cloneJsonValue(this.data.payload.privateData),
      },
    };
  }

  toViewData(viewer: Viewer): TestMovePerformedViewEventData {
    const payload = {
      moveNumber: this.data.payload.moveNumber,
      nextPlayerId: this.data.payload.nextPlayerId,
      playerId: this.data.payload.playerId,
    };

    if (
      viewer.role === 'player' &&
      viewer.playerId === this.data.payload.playerId
    ) {
      return {
        ...this.data,
        payload: {
          ...payload,
          privateData: cloneJsonValue(this.data.payload.privateData),
        },
      };
    }

    return {
      ...this.data,
      payload,
    };
  }
}
