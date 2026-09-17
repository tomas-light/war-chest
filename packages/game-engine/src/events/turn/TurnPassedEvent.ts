import { cloneBattlefield, createBattlefieldView } from '../../Battlefield.js';
import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { TurnPassedEventData } from '../../events.js';
import { cloneGameCoin } from '../../GameCoin.js';
import type { GameState, Viewer } from '../../state.js';
import type { TurnPassedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

export class TurnPassedEvent implements ApplicableEvent<TurnPassedEventData> {
  private constructor(readonly data: TurnPassedEventData) {}

  static fromData(data: TurnPassedEventData): TurnPassedEvent {
    return new TurnPassedEvent({
      ...data,
      payload: {
        ...data.payload,
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

  toData(): TurnPassedEventData {
    return {
      ...this.data,
      payload: {
        ...this.data.payload,
        battlefield: cloneBattlefield(this.data.payload.battlefield),
        coin: cloneGameCoin(this.data.payload.coin),
      },
    };
  }

  toViewData(viewer: Viewer): TurnPassedViewEventData {
    return {
      ...this.data,
      payload: {
        battlefield: createBattlefieldView(
          this.data.payload.battlefield,
          viewer
        ),
        coin:
          viewer.role === 'player' &&
          viewer.playerId === this.data.payload.playerId
            ? cloneGameCoin(this.data.payload.coin)
            : null,
        moveNumber: this.data.payload.moveNumber,
        nextPlayerId: this.data.payload.nextPlayerId,
        playerId: this.data.payload.playerId,
      },
    };
  }
}
