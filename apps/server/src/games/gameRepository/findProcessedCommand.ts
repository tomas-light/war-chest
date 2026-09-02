import { type Database, processedCommands } from '@war-chest/database';
import { eq } from 'drizzle-orm';
import type { ProcessedCommandIdentity } from './GameRepositoryTypes.js';

export async function findProcessedCommand(
  database: Database,
  commandId: string
): Promise<ProcessedCommandIdentity | null> {
  const [command] = await database
    .select({
      commandType: processedCommands.commandType,
      gameId: processedCommands.gameId,
      requestHash: processedCommands.requestHash,
      userId: processedCommands.userId,
    })
    .from(processedCommands)
    .where(eq(processedCommands.id, commandId))
    .limit(1);

  return command ?? null;
}
