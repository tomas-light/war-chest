import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { PlayerReconnectedEventData } from '../../events.js';
import type { GameState } from '../../state.js';
import type { PlayerReconnectedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

// eslint-disable-next-line max-len
export class PlayerReconnectedEvent implements ApplicableEvent<PlayerReconnectedEventData> {
  private constructor(readonly data: PlayerReconnectedEventData) {}

  static fromData(data: PlayerReconnectedEventData): PlayerReconnectedEvent {
    return new PlayerReconnectedEvent({
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
          ? { ...player, presence: 'connected', reconnectDeadline: null }
          : player
      ),
    };
  }

  toData(): PlayerReconnectedEventData {
    return { ...this.data, payload: { ...this.data.payload } };
  }

  toViewData(): PlayerReconnectedViewEventData {
    return this.toData();
  }
}
