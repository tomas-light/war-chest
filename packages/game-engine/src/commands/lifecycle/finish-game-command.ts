import type { FinishGameCommandData } from '../../command-data/lifecycle-command-data.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../decidable-command.js';

// eslint-disable-next-line max-len
export class FinishGameCommand implements DecidableCommand<FinishGameCommandData> {
  private constructor(readonly data: FinishGameCommandData) {}

  static fromData(data: FinishGameCommandData): FinishGameCommand {
    return new FinishGameCommand({ ...data });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    const isActiveGame = state.status === 'active';
    const isCurrentPlayer = state.currentPlayerId === playerId;

    if (!isActiveGame || !isCurrentPlayer) {
      return [];
    }

    return [
      {
        payload: { finishedByPlayerId: playerId },
        sequence: state.lastEventSequence + 1,
        type: 'GameFinished',
        version: GAME_EVENT_VERSION,
      },
    ];
  }

  toData(): FinishGameCommandData {
    return { ...this.data };
  }
}
