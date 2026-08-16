import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { PlayerDefeatedEventData } from '../../events.js';
import type { GameState } from '../../state.js';
import type { PlayerDefeatedViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

// eslint-disable-next-line max-len
export class PlayerDefeatedEvent implements ApplicableEvent<PlayerDefeatedEventData> {
  private constructor(readonly data: PlayerDefeatedEventData) {}

  static fromData(data: PlayerDefeatedEventData): PlayerDefeatedEvent {
    return new PlayerDefeatedEvent({
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
      currentPlayerId:
        state.currentPlayerId === this.data.payload.playerId
          ? null
          : state.currentPlayerId,
      lastEventSequence: this.data.sequence,
      players: state.players.map((player) =>
        player.id === this.data.payload.playerId
          ? { ...player, presence: 'defeated', reconnectDeadline: null }
          : player
      ),
    };
  }

  toData(): PlayerDefeatedEventData {
    return { ...this.data, payload: { ...this.data.payload } };
  }

  toViewData(): PlayerDefeatedViewEventData {
    return this.toData();
  }
}
