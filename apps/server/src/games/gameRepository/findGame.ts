import { type Database, games } from '@war-chest/database';
import { eq } from 'drizzle-orm';
import type { StoredGame } from './GameRepositoryTypes.js';

export async function findGame(
  database: Database,
  gameId: string
): Promise<StoredGame | null> {
  const [game] = await database
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  return game ?? null;
}
