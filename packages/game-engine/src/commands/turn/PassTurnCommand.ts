import type { PassTurnCommandData } from '../../command-data/TurnCommandData.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import { cloneGameCoin } from '../../GameCoin.js';
import { passTurn } from '../../passTurn.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../DecidableCommand.js';

export class PassTurnCommand implements DecidableCommand<PassTurnCommandData> {
  private constructor(readonly data: PassTurnCommandData) {}

  static fromData(data: PassTurnCommandData): PassTurnCommand {
    return new PassTurnCommand({ ...data });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    if (
      state.status !== 'active' ||
      state.currentPlayerId !== playerId ||
      state.settings.format !== 'duel'
    ) {
      return [];
    }

    const resources = state.battlefield?.playerResources.find(
      (item) => item.playerId === playerId
    );
    const selectedCoin = resources?.hand.at(this.data.coinIndex);

    if (selectedCoin === undefined) {
      return [];
    }

    const result = passTurn({
      coinIndex: this.data.coinIndex,
      playerId,
      state,
    });

    if (result === null) {
      return [];
    }

    return [
      {
        payload: {
          battlefield: result.battlefield,
          coin: cloneGameCoin(selectedCoin),
          moveNumber: state.moveCount + 1,
          nextPlayerId: result.nextPlayerId,
          playerId,
        },
        sequence: state.lastEventSequence + 1,
        type: 'TurnPassed',
        version: GAME_EVENT_VERSION,
      },
    ];
  }

  toData(): PassTurnCommandData {
    return { ...this.data };
  }
}
