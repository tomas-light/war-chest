import { createViewFor } from '@war-chest/game-engine';
import { createGamePlayers } from './createGamePlayers.js';
import type { GameServiceContext } from './GameServiceContext.js';
import type {
  GetGameSnapshotInput,
  GetGameSnapshotResult,
} from './GameServiceTypes.js';

export function getSnapshot(
  context: GameServiceContext,
  input: GetGameSnapshotInput
): Promise<GetGameSnapshotResult> {
  return context.options.activeGames.runExclusive(input.gameId, loadSnapshot);

  async function loadSnapshot(): Promise<GetGameSnapshotResult> {
    const activeGame = await context.gameLoader.load(input.gameId);

    if (activeGame === null) {
      return { status: 'gameNotFound' };
    }

    const viewer = await context.gameLoader.resolveViewer({
      gameId: input.gameId,
      state: activeGame.state,
      userId: input.userId,
    });
    const players = await context.options.gameRepository.listGamePlayers(
      input.gameId
    );

    return {
      gameId: input.gameId,
      players: createGamePlayers(players),
      status: 'found',
      view: createViewFor(activeGame.state, viewer),
    };
  }
}
