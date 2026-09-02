import { type Database, gameParticipants } from '@war-chest/database';
import { and, eq } from 'drizzle-orm';
import type { StoredParticipant } from './GameRepositoryTypes.js';

export async function findParticipant(
  database: Database,
  gameId: string,
  userId: string
): Promise<StoredParticipant | null> {
  const [participant] = await database
    .select()
    .from(gameParticipants)
    .where(
      and(
        eq(gameParticipants.gameId, gameId),
        eq(gameParticipants.userId, userId)
      )
    )
    .limit(1);

  return participant ?? null;
}
