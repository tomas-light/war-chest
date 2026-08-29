import type { SurrenderGameCommandData } from '../../command-data/LifecycleCommandData.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../DecidableCommand.js';

// eslint-disable-next-line max-len
export class SurrenderGameCommand implements DecidableCommand<SurrenderGameCommandData> {
  private constructor(readonly data: SurrenderGameCommandData) {}

  static fromData(data: SurrenderGameCommandData): SurrenderGameCommand {
    return new SurrenderGameCommand({ ...data });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    if (state.status !== 'active') {
      return [];
    }

    const surrenderingPlayer = state.players.find(
      (player) => player.id === playerId && player.presence !== 'defeated'
    );
    const winningPlayer = state.players.find(
      (player) => player.id !== playerId && player.presence !== 'defeated'
    );

    if (surrenderingPlayer === undefined || winningPlayer === undefined) {
      return [];
    }

    return [
      {
        payload: { playerId, reason: 'surrender' },
        sequence: state.lastEventSequence + 1,
        type: 'PlayerDefeated',
        version: GAME_EVENT_VERSION,
      },
      {
        payload: { winnerTeam: winningPlayer.team },
        sequence: state.lastEventSequence + 2,
        type: 'GameFinished',
        version: GAME_EVENT_VERSION,
      },
    ];
  }

  toData(): SurrenderGameCommandData {
    return { ...this.data };
  }
}
