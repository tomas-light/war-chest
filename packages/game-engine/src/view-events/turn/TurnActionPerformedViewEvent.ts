import type { GameViewBattlefieldState } from '../../Battlefield.js';
import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameView } from '../../state.js';
import type { TurnActionPerformedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

// eslint-disable-next-line max-len
export class TurnActionPerformedViewEvent implements ApplicableViewEvent<TurnActionPerformedViewEventData> {
  private constructor(readonly data: TurnActionPerformedViewEventData) {}

  static fromData(
    data: TurnActionPerformedViewEventData
  ): TurnActionPerformedViewEvent {
    return new TurnActionPerformedViewEvent({
      ...data,
      payload: {
        ...data.payload,
        action: { ...data.payload.action },
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

  toData(): TurnActionPerformedViewEventData {
    return TurnActionPerformedViewEvent.fromData(this.data).data;
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
