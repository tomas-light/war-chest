import { cloneBattlefield, createBattlefieldView } from '../../Battlefield.js';
import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { TurnActionPerformedEventData } from '../../events.js';
import { cloneGameCoin } from '../../GameCoin.js';
import type { GameState, Viewer } from '../../state.js';
import type { TurnActionPerformedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

// eslint-disable-next-line max-len
export class TurnActionPerformedEvent implements ApplicableEvent<TurnActionPerformedEventData> {
  private constructor(readonly data: TurnActionPerformedEventData) {}

  static fromData(
    data: TurnActionPerformedEventData
  ): TurnActionPerformedEvent {
    return new TurnActionPerformedEvent({
      ...data,
      payload: {
        ...data.payload,
        action: { ...data.payload.action },
        battlefield: cloneBattlefield(data.payload.battlefield),
        coin: cloneGameCoin(data.payload.coin),
      },
    });
  }

  apply(state: GameState | null): GameState {
    if (state === null) {
      throw new NullableGameStateError();
    }

    return {
      ...state,
      battlefield: cloneBattlefield(this.data.payload.battlefield),
      currentPlayerId: this.data.payload.nextPlayerId,
      lastEventSequence: this.data.sequence,
      moveCount: this.data.payload.moveNumber,
      players: state.players.map((player) => {
        if (player.id !== this.data.payload.playerId) {
          return player;
        }

        return { ...player, moveCount: player.moveCount + 1 };
      }),
    };
  }

  toData(): TurnActionPerformedEventData {
    return TurnActionPerformedEvent.fromData(this.data).data;
  }

  toViewData(viewer: Viewer): TurnActionPerformedViewEventData {
    return {
      ...this.data,
      payload: {
        ...this.data.payload,
        action: { ...this.data.payload.action },
        battlefield: createBattlefieldView(
          this.data.payload.battlefield,
          viewer
        ),
        coin:
          this.data.payload.action.type === 'move' ||
          (viewer.role === 'player' &&
            viewer.playerId === this.data.payload.playerId)
            ? cloneGameCoin(this.data.payload.coin)
            : null,
      },
    };
  }
}
