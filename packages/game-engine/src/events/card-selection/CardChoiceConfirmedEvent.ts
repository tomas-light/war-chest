import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { CardChoiceConfirmedEventData } from '../../events.js';
import type { GameState } from '../../state.js';
import type { CardChoiceConfirmedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

// eslint-disable-next-line max-len
export class CardChoiceConfirmedEvent implements ApplicableEvent<CardChoiceConfirmedEventData> {
  private constructor(readonly data: CardChoiceConfirmedEventData) {}

  static fromData(
    data: CardChoiceConfirmedEventData
  ): CardChoiceConfirmedEvent {
    return new CardChoiceConfirmedEvent({
      ...data,
      payload: { ...data.payload },
    });
  }

  apply(state: GameState | null): GameState {
    if (state === null || state.cardSelection === null) {
      throw new NullableGameStateError();
    }

    return {
      ...state,
      cardSelection: {
        ...state.cardSelection,
        choices: [
          ...state.cardSelection.choices,
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
          ? state.players.map((player) =>
              player.id === this.data.payload.playerId
                ? {
                    ...player,
                    cardIds: [...player.cardIds, this.data.payload.unitId],
                  }
                : player
            )
          : state.players,
      status: state.status,
    };
  }

  toData(): CardChoiceConfirmedEventData {
    return { ...this.data, payload: { ...this.data.payload } };
  }

  toViewData(): CardChoiceConfirmedViewEventData {
    return this.toData();
  }
}
