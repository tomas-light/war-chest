import { type Database, gameEvents } from '@war-chest/database';
import { type GameEventData, parseGameEventData } from '@war-chest/game-engine';
import { and, asc, eq, gt } from 'drizzle-orm';

export async function loadEvents(
  database: Database,
  gameId: string,
  afterSequence = 0
): Promise<readonly GameEventData[]> {
  validateAfterSequence(afterSequence);

  const rows = await database
    .select({
      payload: gameEvents.payload,
      sequence: gameEvents.sequence,
      type: gameEvents.type,
      version: gameEvents.version,
    })
    .from(gameEvents)
    .where(
      and(eq(gameEvents.gameId, gameId), gt(gameEvents.sequence, afterSequence))
    )
    .orderBy(asc(gameEvents.sequence));

  return rows.map((row) => parseStoredEvent(row, gameId));
}

function parseStoredEvent(value: unknown, gameId: string): GameEventData {
  const sequence = readSequence(value);

  try {
    return parseGameEventData(value);
  } catch (error) {
    throw new CorruptedGameHistoryError(gameId, sequence, error);
  }
}

function readSequence(value: unknown): number | null {
  if (
    value !== null &&
    typeof value === 'object' &&
    'sequence' in value &&
    typeof value.sequence === 'number'
  ) {
    return value.sequence;
  }

  return null;
}

function validateAfterSequence(afterSequence: number): void {
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) {
    throw new Error('afterSequence must be a non-negative safe integer.');
  }
}

class CorruptedGameHistoryError extends Error {
  constructor(gameId: string, sequence: number | null, cause: unknown) {
    const sequenceDescription = sequence === null ? 'unknown' : sequence;

    super(
      `Stored event ${sequenceDescription} for game ${gameId} is corrupted.`,
      { cause }
    );
    this.name = 'CorruptedGameHistoryError';
  }
}
