import {
  type Database,
  gameEvents,
  games,
  processedCommands,
} from '@war-chest/database';
import { eq } from 'drizzle-orm';
import type {
  DeleteWaitingGameInput,
  DeleteWaitingGameResult,
} from './GameRepositoryTypes.js';

export function deleteWaitingGame(
  database: Database,
  input: DeleteWaitingGameInput
): Promise<DeleteWaitingGameResult> {
  return database.transaction(async (transaction) => {
    const [storedGame] = await transaction
      .select({ currentVersion: games.currentVersion, status: games.status })
      .from(games)
      .where(eq(games.id, input.gameId))
      .limit(1)
      .for('update');

    if (storedGame === undefined) {
      return { status: 'notFound' };
    }

    if (storedGame.status !== 'waiting') {
      return { status: 'notWaiting' };
    }

    if (storedGame.currentVersion !== input.expectedVersion) {
      return {
        currentVersion: storedGame.currentVersion,
        status: 'versionConflict',
      };
    }

    await transaction
      .delete(gameEvents)
      .where(eq(gameEvents.gameId, input.gameId));
    await transaction
      .delete(processedCommands)
      .where(eq(processedCommands.gameId, input.gameId));
    const [deletedGame] = await transaction
      .delete(games)
      .where(eq(games.id, input.gameId))
      .returning({ id: games.id });

    if (deletedGame === undefined) {
      throw new Error(`Waiting game ${input.gameId} was not deleted.`);
    }

    return { status: 'deleted' };
  });
}
