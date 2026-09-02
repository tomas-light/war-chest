import type { GameServiceContext } from './GameServiceContext.js';
import type {
  GetGameEventsInput,
  GetGameEventsResult,
} from './GameServiceTypes.js';

export function getEvents(
  context: GameServiceContext,
  input: GetGameEventsInput
): Promise<GetGameEventsResult> {
  return context.options.activeGames.runExclusive(input.gameId, loadEvents);

  async function loadEvents(): Promise<GetGameEventsResult> {
    const activeGame = await context.gameLoader.load(input.gameId);

    if (activeGame === null) {
      return { status: 'gameNotFound' };
    }

    const viewer = await context.gameLoader.resolveViewer({
      gameId: input.gameId,
      state: activeGame.state,
      userId: input.userId,
    });
    const events =
      input.afterSequence > activeGame.state.lastEventSequence
        ? []
        : await context.gameSynchronization.createViewEventTail({
            afterSequence: input.afterSequence,
            currentVersion: activeGame.state.lastEventSequence,
            gameId: input.gameId,
            viewer,
          });

    return { events, gameId: input.gameId, status: 'found' };
  }
}
