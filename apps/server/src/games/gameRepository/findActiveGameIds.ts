import { type Database, games } from '@war-chest/database';
import { eq } from 'drizzle-orm';

export async function findActiveGameIds(
  database: Database
): Promise<readonly string[]> {
  const activeGames = await database
    .select({ id: games.id })
    .from(games)
    .where(eq(games.status, 'active'));

  return activeGames.map((game) => game.id);
}
