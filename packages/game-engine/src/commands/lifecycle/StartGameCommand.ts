import type { StartGameCommandData } from '../../command-data/LifecycleCommandData.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../DecidableCommand.js';
import {
  FIRST_PLAYER_SEAT,
  FIRST_PLAYER_TEAM,
  REQUIRED_PLAYER_COUNT,
} from './lifecycleRules.js';

// eslint-disable-next-line max-len
export class StartGameCommand implements DecidableCommand<StartGameCommandData> {
  private constructor(readonly data: StartGameCommandData) {}

  static fromData(data: StartGameCommandData): StartGameCommand {
    return new StartGameCommand({ ...data });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    const isWaitingGame = state.status === 'waiting';
    const hasRequiredPlayers = state.players.length === REQUIRED_PLAYER_COUNT;

    // Состав может заполниться без участия создателя, но право начать партию
    // остаётся только у пользователя, который создал эту игру.
    const isGameCreator = state.creatorId === playerId;

    if (!isWaitingGame || !hasRequiredPlayers || !isGameCreator) {
      return [];
    }

    const firstPlayer = state.players.find(
      (player) =>
        player.team === FIRST_PLAYER_TEAM && player.seat === FIRST_PLAYER_SEAT
    );
    if (firstPlayer == null) {
      return [];
    }

    return [
      {
        payload: {
          firstPlayerId: firstPlayer.id,
        },
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
