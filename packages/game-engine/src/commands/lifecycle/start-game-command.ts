import type { StartGameCommandData } from '../../command-data/lifecycle-command-data.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../decidable-command.js';
import { REQUIRED_PLAYER_COUNT } from './lifecycle-rules.js';

// eslint-disable-next-line max-len
export class StartGameCommand implements DecidableCommand<StartGameCommandData> {
  private constructor(readonly data: StartGameCommandData) {}

  static fromData(data: StartGameCommandData): StartGameCommand {
    return new StartGameCommand({ ...data });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    const isWaitingGame = state.status === 'waiting';
    const hasRequiredPlayers = state.players.length === REQUIRED_PLAYER_COUNT;

    // Заполненные места не означают, что команду отправил участник игры:
    // посторонний игрок или зритель не должен иметь возможность начать партию.
    const isJoinedPlayer = state.players.some(
      (player) => player.id === playerId
    );

    if (!isWaitingGame || !hasRequiredPlayers || !isJoinedPlayer) {
      return [];
    }

    const [firstPlayer] = state.players;
    if (firstPlayer == null) {
      return [];
    }

    return [
      {
        payload: { firstPlayerId: firstPlayer.id },
        sequence: state.lastEventSequence + 1,
        type: 'GameStarted',
        version: GAME_EVENT_VERSION,
      },
    ];
  }

  toData(): StartGameCommandData {
    return { ...this.data };
  }
}
