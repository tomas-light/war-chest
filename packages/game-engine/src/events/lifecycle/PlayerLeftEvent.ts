import { NullableGameStateError } from '../../errors/NullableGameStateError.js';
import type { PlayerLeftEventData } from '../../events.js';
import type { GameState } from '../../state.js';
import type { PlayerLeftViewEventData } from '../../viewEvents.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';

export class PlayerLeftEvent implements ApplicableEvent<PlayerLeftEventData> {
  private constructor(readonly data: PlayerLeftEventData) {}

  static fromData(data: PlayerLeftEventData): PlayerLeftEvent {
    return new PlayerLeftEvent({ ...data, payload: { ...data.payload } });
  }

  apply(state: GameState | null): GameState {
    if (state === null) {
      throw new NullableGameStateError();
    }

    const playerId = this.data.payload.playerId;

    return {
      ...state,
      lastEventSequence: this.data.sequence,
      players: state.players.filter((player) => player.id !== playerId),
      teams: {
        black: state.teams.black.filter(
          (teamPlayerId) => teamPlayerId !== playerId
        ),
        white: state.teams.white.filter(
          (teamPlayerId) => teamPlayerId !== playerId
        ),
      },
    };
  }

  toData(): PlayerLeftEventData {
    return { ...this.data, payload: { ...this.data.payload } };
  }

  toViewData(): PlayerLeftViewEventData {
    return this.toData();
  }
}
