import type { JoinGameCommandData } from '../../command-data/lifecycle-command-data.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../decidable-command.js';
import { isGamePosition } from './lifecycle-rules.js';

export class JoinGameCommand implements DecidableCommand<JoinGameCommandData> {
  private constructor(readonly data: JoinGameCommandData) {}

  static fromData(data: JoinGameCommandData): JoinGameCommand {
    return new JoinGameCommand({ ...data });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    const isWaitingGame = state.status === 'waiting';
    const isSupportedPosition = isGamePosition(this.data.team, this.data.seat);
    const isAvailablePosition = !state.players.some(
      (player) =>
        player.team === this.data.team && player.seat === this.data.seat
    );
    const isNewPlayer = !state.players.some((player) => player.id === playerId);

    if (
      !isWaitingGame ||
      !isSupportedPosition ||
      !isAvailablePosition ||
      !isNewPlayer
    ) {
      return [];
    }

    return [
      {
        payload: {
          playerId,
          seat: this.data.seat,
          team: this.data.team,
        },
        sequence: state.lastEventSequence + 1,
        type: 'PlayerJoined',
        version: GAME_EVENT_VERSION,
      },
    ];
  }

  toData(): JoinGameCommandData {
    return { ...this.data };
  }
}
