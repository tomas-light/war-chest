import { type Database, activeGamePlayers } from '@war-chest/database';
import { eq } from 'drizzle-orm';

export async function findCurrentPlayerGame(
  database: Database,
  userId: string
): Promise<string | null> {
  const [activeGame] = await database
    .select({ gameId: activeGamePlayers.gameId })
    .from(activeGamePlayers)
    .where(eq(activeGamePlayers.userId, userId))
    .limit(1);

  return activeGame?.gameId ?? null;
}
