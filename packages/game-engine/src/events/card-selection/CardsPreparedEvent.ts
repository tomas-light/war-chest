import { cloneGameStartSelection } from '../../CardSelection.js';
import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { CardsPreparedEventData } from '../../events.js';
import type { GameState } from '../../state.js';
import type { CardsPreparedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

// eslint-disable-next-line max-len
export class CardsPreparedEvent implements ApplicableEvent<CardsPreparedEventData> {
  private constructor(readonly data: CardsPreparedEventData) {}

  static fromData(data: CardsPreparedEventData): CardsPreparedEvent {
    return new CardsPreparedEvent({
      ...data,
      payload: {
        playerOrder: [...data.payload.playerOrder],
        selection: cloneGameStartSelection(data.payload.selection),
      },
    });
  }

  apply(state: GameState | null): GameState {
    if (state === null) {
      throw new NullableGameStateError();
    }

    const { selection } = this.data.payload;

    if (selection.mode === 'random') {
      return {
        ...state,
        lastEventSequence: this.data.sequence,
        players: state.players.map((player) => {
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
      ...state,
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

  toData(): CardsPreparedEventData {
    return {
      ...this.data,
      payload: {
        playerOrder: [...this.data.payload.playerOrder],
        selection: cloneGameStartSelection(this.data.payload.selection),
      },
    };
  }

  toViewData(): CardsPreparedViewEventData {
    return this.toData();
  }
}
