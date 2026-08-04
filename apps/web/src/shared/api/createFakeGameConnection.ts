import { GAME_RULES_VERSION } from '@war-chest/game-engine';
import type { GameConnection, GameConnectionHandlers } from './gameConnection';

export function createFakeGameConnection(
  handlers: GameConnectionHandlers
): GameConnection {
  return {
    connect() {},
    disconnect() {},
    join(gameId) {
      queueMicrotask(() => {
        handlers.onSnapshot({
          gameId,
          view: {
            currentPlayerId: null,
            featureFlags: {},
            lastEventSequence: 1,
            moveCount: 0,
            players: [],
            privateMoves: [],
            rulesVersion: GAME_RULES_VERSION,
            status: 'waiting',
            teams: { black: [], white: [] },
            winnerTeam: null,
          },
        });
      });
    },
    leave() {},
    synchronize() {},
  };
}
