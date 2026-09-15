import { createGameStart } from '../../CardSelection.js';
import type { StartGameCommandData } from '../../command-data/LifecycleCommandData.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../DecidableCommand.js';
import { getRequiredPlayerCount } from './lifecycleRules.js';

// eslint-disable-next-line max-len
export class StartGameCommand implements DecidableCommand<StartGameCommandData> {
  private constructor(readonly data: StartGameCommandData) {}

  static fromData(data: StartGameCommandData): StartGameCommand {
    return new StartGameCommand({ ...data });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    const isWaitingGame = state.status === 'waiting';
    const hasRequiredPlayers =
      state.players.length === getRequiredPlayerCount(state.settings.format);

    // Состав может заполниться без участия создателя, но право начать партию
    // остаётся только у пользователя, который создал эту игру.
    const isGameCreator = state.creatorId === playerId;

    if (!isWaitingGame || !hasRequiredPlayers || !isGameCreator) {
      return [];
    }

    const gameStart = createGameStart({
      format: state.settings.format,
      mode: state.settings.cardSelectionMode,
      players: state.players,
    });

    return [
      {
        payload: {
          firstPlayerId: gameStart.firstPlayerId,
        },
        sequence: state.lastEventSequence + 1,
        type: 'GameStarted',
        version: GAME_EVENT_VERSION,
      },
      {
        payload: {
          playerOrder: gameStart.playerOrder,
          selection: gameStart.selection,
        },
        sequence: state.lastEventSequence + 2,
        type: 'CardsPrepared',
        version: GAME_EVENT_VERSION,
      },
    ];
  }

  toData(): StartGameCommandData {
    return { ...this.data };
  }
}
