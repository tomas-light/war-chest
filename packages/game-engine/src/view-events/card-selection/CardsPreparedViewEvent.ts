import { cloneGameStartSelection } from '../../CardSelection.js';
import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameView } from '../../state.js';
import type { CardsPreparedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

// eslint-disable-next-line max-len
export class CardsPreparedViewEvent implements ApplicableViewEvent<CardsPreparedViewEventData> {
  private constructor(readonly data: CardsPreparedViewEventData) {}

  static fromData(data: CardsPreparedViewEventData): CardsPreparedViewEvent {
    return new CardsPreparedViewEvent({
      ...data,
      payload: {
        playerOrder: [...data.payload.playerOrder],
        selection: cloneGameStartSelection(data.payload.selection),
      },
    });
  }

  apply(view: GameView | null): GameView {
    if (view === null) {
      throw new NullableGameViewError();
    }

    const { selection } = this.data.payload;

    if (selection.mode === 'random') {
      return {
        ...view,
        lastEventSequence: this.data.sequence,
        players: view.players.map((player) => {
          const assignment = selection.assignments.find(
            (item) => item.playerId === player.id
          );

          return assignment === undefined
            ? player
            : { ...player, cardIds: [...assignment.unitIds] };
        }),
      };
    }

    return {
      ...view,
      cardSelection: {
        choices: [],
        phase: selection.mode === 'eliminationDraft' ? 'banning' : 'picking',
        playerOrder: [...this.data.payload.playerOrder],
        pool: [...selection.pool],
      },
      lastEventSequence: this.data.sequence,
      status: 'cardSelection',
    };
  }

  toData(): CardsPreparedViewEventData {
    return {
      ...this.data,
      payload: {
        playerOrder: [...this.data.payload.playerOrder],
        selection: cloneGameStartSelection(this.data.payload.selection),
      },
    };
  }
}
