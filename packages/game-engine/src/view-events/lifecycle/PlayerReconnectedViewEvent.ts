import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameView } from '../../state.js';
import type { PlayerReconnectedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

// eslint-disable-next-line max-len
export class PlayerReconnectedViewEvent implements ApplicableViewEvent<PlayerReconnectedViewEventData> {
  private constructor(readonly data: PlayerReconnectedViewEventData) {}

  static fromData(
    data: PlayerReconnectedViewEventData
  ): PlayerReconnectedViewEvent {
    return new PlayerReconnectedViewEvent({
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
      lastEventSequence: this.data.sequence,
      players: view.players.map((player) =>
        player.id === this.data.payload.playerId
          ? { ...player, presence: 'connected', reconnectDeadline: null }
          : player
      ),
    };
  }

  toData(): PlayerReconnectedViewEventData {
    return { ...this.data, payload: { ...this.data.payload } };
  }
}
