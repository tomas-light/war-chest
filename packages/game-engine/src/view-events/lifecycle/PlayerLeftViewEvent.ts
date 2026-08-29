import { NullableGameViewError } from '../../errors/NullableGameViewError.js';
import type { GameView } from '../../state.js';
import type { PlayerLeftViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';

// eslint-disable-next-line max-len
export class PlayerLeftViewEvent implements ApplicableViewEvent<PlayerLeftViewEventData> {
  private constructor(readonly data: PlayerLeftViewEventData) {}

  static fromData(data: PlayerLeftViewEventData): PlayerLeftViewEvent {
    return new PlayerLeftViewEvent({
      ...data,
      payload: { ...data.payload },
    });
  }

  apply(view: GameView | null): GameView {
    if (view === null) {
      throw new NullableGameViewError();
    }

    const playerId = this.data.payload.playerId;

    return {
      ...view,
      lastEventSequence: this.data.sequence,
      players: view.players.filter((player) => player.id !== playerId),
      teams: {
        black: view.teams.black.filter(
          (teamPlayerId) => teamPlayerId !== playerId
        ),
        white: view.teams.white.filter(
          (teamPlayerId) => teamPlayerId !== playerId
        ),
      },
    };
  }

  toData(): PlayerLeftViewEventData {
    return { ...this.data, payload: { ...this.data.payload } };
  }
}
