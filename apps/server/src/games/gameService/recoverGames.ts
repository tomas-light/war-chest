import type { StoredEmptyWaitingGame } from '../gameRepository/GameRepositoryTypes.js';
import type { GameServiceContext } from './GameServiceContext.js';
import type { EmptyWaitingGameExpirationInput } from './GameServiceTypes.js';
import { getCurrentDate } from './getCurrentDate.js';

export async function recoverGames(context: GameServiceContext): Promise<void> {
  const [activeGameIds, emptyWaitingGames] = await Promise.all([
    context.options.gameRepository.findActiveGameIds(),
    context.options.gameRepository.listEmptyWaitingGames(),
  ]);

  await Promise.all([
    ...activeGameIds.map((gameId) =>
      context.options.activeGames.runExclusive(gameId, async () => {
        await context.gameLoader.load(gameId);
      })
    ),
    ...emptyWaitingGames.map(recoverEmptyWaitingGame),
  ]);

  async function recoverEmptyWaitingGame(
    game: StoredEmptyWaitingGame
  ): Promise<void> {
    const input: EmptyWaitingGameExpirationInput = {
      expiresAt: context.emptyWaitingGameExpiration.createExpiresAt(
        game.createdAt
      ),
      gameId: game.id,
      retryAttempt: 0,
    };

    if (new Date(input.expiresAt).getTime() <= getCurrentDate().getTime()) {
      await context.emptyWaitingGameExpiration.process(input);
      return;
    }

    context.emptyWaitingGameExpiration.schedule(input);
  }
}
