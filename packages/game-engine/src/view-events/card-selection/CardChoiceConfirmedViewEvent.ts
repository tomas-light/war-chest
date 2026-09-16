import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameView } from '../../state.js';
import type { CardChoiceConfirmedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

// eslint-disable-next-line max-len
export class CardChoiceConfirmedViewEvent implements ApplicableViewEvent<CardChoiceConfirmedViewEventData> {
  private constructor(readonly data: CardChoiceConfirmedViewEventData) {}

  static fromData(
    data: CardChoiceConfirmedViewEventData
  ): CardChoiceConfirmedViewEvent {
    return new CardChoiceConfirmedViewEvent({
      ...data,
      payload: { ...data.payload },
    });
  }

  apply(view: GameView | null): GameView {
    if (view === null || view.cardSelection === null) {
      throw new NullableGameViewError();
    }

    return {
      ...view,
      cardSelection: {
        ...view.cardSelection,
        choices: [
          ...view.cardSelection.choices,
          {
            action: this.data.payload.action,
            playerId: this.data.payload.playerId,
            unitId: this.data.payload.unitId,
          },
        ],
        phase: this.data.payload.nextPhase,
      },
      currentPlayerId: this.data.payload.nextPlayerId,
      lastEventSequence: this.data.sequence,
      players:
        this.data.payload.action === 'pick'
          ? view.players.map((player) =>
              player.id === this.data.payload.playerId
                ? {
                    ...player,
                    cardIds: [...player.cardIds, this.data.payload.unitId],
                  }
                : player
            )
          : view.players,
      status: view.status,
    };
  }

  toData(): CardChoiceConfirmedViewEventData {
    return { ...this.data, payload: { ...this.data.payload } };
  }
}
