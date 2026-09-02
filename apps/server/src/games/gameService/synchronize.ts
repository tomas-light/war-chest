import type { GameServiceContext } from './GameServiceContext.js';
import type {
  SynchronizeGameInput,
  SynchronizeGameResult,
} from './GameServiceTypes.js';

export function synchronize(
  context: GameServiceContext,
  input: SynchronizeGameInput
): Promise<SynchronizeGameResult> {
  return context.options.activeGames.runExclusive(
    input.gameId,
    synchronizeGame
  );

  async function synchronizeGame(): Promise<SynchronizeGameResult> {
    const activeGame = await context.gameLoader.load(input.gameId);

    if (activeGame === null) {
      return { status: 'gameNotFound' };
    }

    const viewer = await context.gameLoader.resolveViewer({
      gameId: input.gameId,
      state: activeGame.state,
      userId: input.userId,
    });

    return {
      currentVersion: activeGame.state.lastEventSequence,
      gameId: input.gameId,
      status: 'found',
      synchronization: await context.gameSynchronization.create({
        afterSequence: input.afterSequence,
        gameId: input.gameId,
        state: activeGame.state,
        viewer,
      }),
    };
  }
}
