import {
  type Database,
  gameEvents,
  gameParticipants,
  games,
  processedCommands,
} from '@war-chest/database';
import { eq } from 'drizzle-orm';
import type {
  DeleteExpiredWaitingGameInput,
  DeleteExpiredWaitingGameResult,
} from './GameRepositoryTypes.js';

export function deleteExpiredWaitingGame(
  database: Database,
  input: DeleteExpiredWaitingGameInput
): Promise<DeleteExpiredWaitingGameResult> {
  return database.transaction(async (transaction) => {
    const [storedGame] = await transaction
      .select({ createdAt: games.createdAt, status: games.status })
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

    if (storedGame.createdAt.getTime() > input.expiredBefore.getTime()) {
      return { createdAt: storedGame.createdAt, status: 'notExpired' };
    }

    const [storedParticipant] = await transaction
      .select({ gameId: gameParticipants.gameId })
      .from(gameParticipants)
      .where(eq(gameParticipants.gameId, input.gameId))
      .limit(1);

    if (storedParticipant !== undefined) {
      return { status: 'notEmpty' };
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
      throw new Error(`Expired waiting game ${input.gameId} was not deleted.`);
    }

    return { status: 'deleted' };
  });
}
