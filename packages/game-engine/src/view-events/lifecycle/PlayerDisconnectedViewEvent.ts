import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameView } from '../../state.js';
import type { PlayerDisconnectedViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

// eslint-disable-next-line max-len
export class PlayerDisconnectedViewEvent implements ApplicableViewEvent<PlayerDisconnectedViewEventData> {
  private constructor(readonly data: PlayerDisconnectedViewEventData) {}

  static fromData(
    data: PlayerDisconnectedViewEventData
  ): PlayerDisconnectedViewEvent {
    return new PlayerDisconnectedViewEvent({
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
          ? {
              ...player,
              presence: 'disconnected',
              reconnectDeadline: this.data.payload.reconnectDeadline,
            }
          : player
      ),
    };
  }

  toData(): PlayerDisconnectedViewEventData {
    return { ...this.data, payload: { ...this.data.payload } };
  }
}
