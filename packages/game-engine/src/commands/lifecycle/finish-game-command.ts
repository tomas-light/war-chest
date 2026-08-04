import type { FinishGameCommandData } from '../../command-data/lifecycle-command-data.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import type { GameState, GameTeam, GameTeams } from '../../state.js';
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

    const winnerTeam = findPlayerTeam(state.teams, playerId);

    if (!isActiveGame || !isCurrentPlayer || winnerTeam === null) {
      return [];
    }

    return [
      {
        payload: { winnerTeam },
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

function findPlayerTeam(teams: GameTeams, playerId: string): GameTeam | null {
  if (teams.white.includes(playerId)) {
    return 'white';
  }

  if (teams.black.includes(playerId)) {
    return 'black';
  }

  return null;
}
