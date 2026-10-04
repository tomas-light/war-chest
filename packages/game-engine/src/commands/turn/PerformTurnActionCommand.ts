import { cloneTurnAction } from '../../cloneTurnAction.js';
import type { PerformTurnActionCommandData } from '../../command-data/TurnCommandData.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import { cloneGameCoin } from '../../GameCoin.js';
import { performTurnAction } from '../../performTurnAction.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../DecidableCommand.js';

// eslint-disable-next-line max-len
export class PerformTurnActionCommand implements DecidableCommand<PerformTurnActionCommandData> {
  private constructor(readonly data: PerformTurnActionCommandData) {}

  static fromData(
    data: PerformTurnActionCommandData
  ): PerformTurnActionCommand {
    return new PerformTurnActionCommand({
      ...data,
      action: cloneTurnAction(data.action),
    });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    const selectedCoin = state.battlefield?.playerResources
      .find((item) => item.playerId === playerId)
      ?.hand.at(this.data.coinIndex);

    if (selectedCoin === undefined) {
      return [];
    }

    const result = performTurnAction({
      action: this.data.action,
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
          action: cloneTurnAction(this.data.action),
          battlefield: result.battlefield,
          coin: cloneGameCoin(selectedCoin),
          moveNumber: state.moveCount + 1,
          nextPlayerId: result.nextPlayerId,
          playerId,
        },
        sequence: state.lastEventSequence + 1,
        type: 'TurnActionPerformed',
        version: GAME_EVENT_VERSION,
      },
    ];
  }

  toData(): PerformTurnActionCommandData {
    return { ...this.data, action: cloneTurnAction(this.data.action) };
  }
}
