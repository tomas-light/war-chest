import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { PlayerDisconnectedEventData } from '../../events.js';
import type { GameState } from '../../state.js';
import type { PlayerDisconnectedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

// eslint-disable-next-line max-len
export class PlayerDisconnectedEvent implements ApplicableEvent<PlayerDisconnectedEventData> {
  private constructor(readonly data: PlayerDisconnectedEventData) {}

  static fromData(data: PlayerDisconnectedEventData): PlayerDisconnectedEvent {
    return new PlayerDisconnectedEvent({
      ...data,
      payload: { ...data.payload },
    });
  }

  apply(state: GameState | null): GameState {
    if (state === null) {
      throw new NullableGameStateError();
    }

    return {
      ...state,
      lastEventSequence: this.data.sequence,
      players: state.players.map((player) =>
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

  toData(): PlayerDisconnectedEventData {
    return { ...this.data, payload: { ...this.data.payload } };
  }

  toViewData(): PlayerDisconnectedViewEventData {
    return this.toData();
  }
}
