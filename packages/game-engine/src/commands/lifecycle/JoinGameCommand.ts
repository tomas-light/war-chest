import type { JoinGameCommandData } from '../../command-data/LifecycleCommandData.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../DecidableCommand.js';
import { isGamePosition } from './lifecycleRules.js';

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
        player.id !== playerId &&
        player.team === this.data.team &&
        player.seat === this.data.seat
    );
    const existingPlayer = state.players.find(
      (player) => player.id === playerId
    );
    const hasRequestedPosition =
      existingPlayer?.team === this.data.team &&
      existingPlayer.seat === this.data.seat;

    if (
      !isWaitingGame ||
      !isSupportedPosition ||
      !isAvailablePosition ||
      hasRequestedPosition
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
        type:
          existingPlayer === undefined
            ? 'PlayerJoined'
            : 'PlayerPositionChanged',
        version: GAME_EVENT_VERSION,
      },
    ];
  }

  toData(): JoinGameCommandData {
    return { ...this.data };
  }
}
