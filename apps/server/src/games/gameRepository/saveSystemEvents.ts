import {
  type Database,
  activeGamePlayers,
  gameEvents,
  games,
} from '@war-chest/database';
import { eq } from 'drizzle-orm';
import type {
  SaveSystemEventsInput,
  SaveSystemEventsResult,
} from './GameRepositoryTypes.js';
import {
  validateEventSequence,
  validateExpectedVersion,
  validateNonEmptyEvents,
} from './gameRepositoryValidation.js';

export function saveSystemEvents(
  database: Database,
  input: SaveSystemEventsInput
): Promise<SaveSystemEventsResult> {
  validateExpectedVersion(input.expectedVersion);
  validateNonEmptyEvents(input.events);

  return database.transaction(async (transaction) => {
    const [storedGame] = await transaction
      .select({ currentVersion: games.currentVersion })
      .from(games)
      .where(eq(games.id, input.gameId))
      .limit(1)
      .for('update');

    if (storedGame === undefined) {
      throw new Error(`Game ${input.gameId} does not exist.`);
    }

    if (input.expectedVersion !== storedGame.currentVersion) {
      return {
        currentVersion: storedGame.currentVersion,
        status: 'versionConflict',
      };
    }

    validateEventSequence(input.events, storedGame.currentVersion);
    await transaction.insert(gameEvents).values(
      input.events.map((event) => ({
        commandId: null,
        gameId: input.gameId,
        payload: event.payload,
        sequence: event.sequence,
        type: event.type,
        version: event.version,
      }))
    );
    const lastEvent = input.events.at(-1);

    if (lastEvent === undefined) {
      throw new Error('Saved system events must not be empty.');
    }

    await transaction
      .update(games)
      .set({ ...input.gameChanges, currentVersion: lastEvent.sequence })
      .where(eq(games.id, input.gameId));

    if (input.gameChanges?.status === 'finished') {
      await transaction
        .delete(activeGamePlayers)
        .where(eq(activeGamePlayers.gameId, input.gameId));
    }

    return { currentVersion: lastEvent.sequence, status: 'saved' };
  });
}
