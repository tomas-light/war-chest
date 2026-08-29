import type { LeaveGameCommandData } from '../../command-data/LifecycleCommandData.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../DecidableCommand.js';

// eslint-disable-next-line max-len
export class LeaveGameCommand implements DecidableCommand<LeaveGameCommandData> {
  private constructor(readonly data: LeaveGameCommandData) {}

  static fromData(data: LeaveGameCommandData): LeaveGameCommand {
    return new LeaveGameCommand({ ...data });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    const isWaitingGame = state.status === 'waiting';
    const isJoinedPlayer = state.players.some(
      (player) => player.id === playerId
    );

    if (!isWaitingGame || !isJoinedPlayer) {
      return [];
    }

    return [
      {
        payload: { playerId },
        sequence: state.lastEventSequence + 1,
        type: 'PlayerLeft',
        version: GAME_EVENT_VERSION,
      },
    ];
  }

  toData(): LeaveGameCommandData {
    return { ...this.data };
  }
}
