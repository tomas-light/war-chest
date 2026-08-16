import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameView } from '../../state.js';
import type { PlayerDefeatedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

// eslint-disable-next-line max-len
export class PlayerDefeatedViewEvent implements ApplicableViewEvent<PlayerDefeatedViewEventData> {
  private constructor(readonly data: PlayerDefeatedViewEventData) {}

  static fromData(data: PlayerDefeatedViewEventData): PlayerDefeatedViewEvent {
    return new PlayerDefeatedViewEvent({
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
      currentPlayerId:
        view.currentPlayerId === this.data.payload.playerId
          ? null
          : view.currentPlayerId,
      lastEventSequence: this.data.sequence,
      players: view.players.map((player) =>
        player.id === this.data.payload.playerId
          ? { ...player, presence: 'defeated', reconnectDeadline: null }
          : player
      ),
    };
  }

  toData(): PlayerDefeatedViewEventData {
    return { ...this.data, payload: { ...this.data.payload } };
  }
}
