import type { GameViewBattlefieldState } from '../../Battlefield.js';
import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameView } from '../../state.js';
import type { TurnPassedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

// eslint-disable-next-line max-len
export class TurnPassedViewEvent implements ApplicableViewEvent<TurnPassedViewEventData> {
  private constructor(readonly data: TurnPassedViewEventData) {}

  static fromData(data: TurnPassedViewEventData): TurnPassedViewEvent {
    return new TurnPassedViewEvent({
      ...data,
      payload: {
        ...data.payload,
        battlefield: cloneViewBattlefield(data.payload.battlefield),
        coin: data.payload.coin === null ? null : { ...data.payload.coin },
      },
    });
  }

  apply(view: GameView | null): GameView {
    if (view === null) {
      throw new NullableGameViewError();
    }

    return {
      ...view,
      battlefield: cloneViewBattlefield(this.data.payload.battlefield),
      currentPlayerId: this.data.payload.nextPlayerId,
      lastEventSequence: this.data.sequence,
      moveCount: this.data.payload.moveNumber,
      players: view.players.map((player) => {
        if (player.id !== this.data.payload.playerId) {
          return player;
        }

        return { ...player, moveCount: player.moveCount + 1 };
      }),
    };
  }

  toData(): TurnPassedViewEventData {
    return {
      ...this.data,
      payload: {
        ...this.data.payload,
        battlefield: cloneViewBattlefield(this.data.payload.battlefield),
        coin:
          this.data.payload.coin === null
            ? null
            : { ...this.data.payload.coin },
      },
    };
  }
}

function cloneViewBattlefield(
  battlefield: GameViewBattlefieldState
): GameViewBattlefieldState {
  return {
    controlPoints: battlefield.controlPoints.map((point) => ({ ...point })),
    playerResources: battlefield.playerResources.map((resources) => ({
      ...resources,
      discard: resources.discard.map((discardedCoin) => ({
        coin: discardedCoin.coin === null ? null : { ...discardedCoin.coin },
        faceUp: discardedCoin.faceUp,
      })),
      eliminated: [...resources.eliminated],
      hand:
        resources.hand === null
          ? null
          : resources.hand.map((coin) => ({ ...coin })),
      supply: resources.supply.map((item) => ({ ...item })),
    })),
    round: battlefield.round,
    units: battlefield.units.map((unit) => ({ ...unit })),
  };
}
