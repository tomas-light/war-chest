import { type Database, gameParticipants, games } from '@war-chest/database';
import { and, eq, isNull } from 'drizzle-orm';
import type { StoredEmptyWaitingGame } from './GameRepositoryTypes.js';

export function listEmptyWaitingGames(
  database: Database
): Promise<readonly StoredEmptyWaitingGame[]> {
  return database
    .select({ createdAt: games.createdAt, id: games.id })
    .from(games)
    .leftJoin(gameParticipants, eq(gameParticipants.gameId, games.id))
    .where(and(eq(games.status, 'waiting'), isNull(gameParticipants.gameId)));
}
