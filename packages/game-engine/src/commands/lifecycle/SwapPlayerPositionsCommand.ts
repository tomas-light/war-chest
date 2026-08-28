import type { SwapPlayerPositionsCommandData } from '../../command-data/LifecycleCommandData.js';
import { type GameEventData, GAME_EVENT_VERSION } from '../../events.js';
import type { GameState } from '../../state.js';
import type { DecidableCommand } from '../DecidableCommand.js';

const REQUIRED_PLAYER_COUNT = 2;

// eslint-disable-next-line max-len
export class SwapPlayerPositionsCommand implements DecidableCommand<SwapPlayerPositionsCommandData> {
  private constructor(readonly data: SwapPlayerPositionsCommandData) {}

  static fromData(
    data: SwapPlayerPositionsCommandData
  ): SwapPlayerPositionsCommand {
    return new SwapPlayerPositionsCommand({ ...data });
  }

  decide(state: GameState, playerId: string): GameEventData[] {
    const [firstPlayer, secondPlayer] = state.players;
    const canSwapPlayers =
      state.status === 'waiting' &&
      state.creatorId === playerId &&
      state.players.length === REQUIRED_PLAYER_COUNT &&
      firstPlayer !== undefined &&
      secondPlayer !== undefined;

    if (!canSwapPlayers) {
      return [];
    }

    return [
      {
        payload: {
          positions: [
            {
              playerId: firstPlayer.id,
              seat: secondPlayer.seat,
              team: secondPlayer.team,
            },
            {
              playerId: secondPlayer.id,
              seat: firstPlayer.seat,
              team: firstPlayer.team,
            },
          ],
        },
        sequence: state.lastEventSequence + 1,
        type: 'PlayerPositionsSwapped',
        version: GAME_EVENT_VERSION,
      },
    ];
  }

  toData(): SwapPlayerPositionsCommandData {
    return { ...this.data };
  }
}
