import {
  type Database,
  gameEvents,
  games,
  processedCommands,
} from '@war-chest/database';
import { parseGameEventData } from '@war-chest/game-engine';
import { eq } from 'drizzle-orm';
import type {
  CreateStoredGameInput,
  CreateStoredGameResult,
  ProcessedCommandIdentity,
} from './GameRepositoryTypes.js';
import { validateRequestHash } from './gameRepositoryValidation.js';
import { hasPostgreSqlConstraintViolation } from './hasPostgreSqlConstraintViolation.js';

const CREATE_GAME_COMMAND_TYPE = 'CreateGame';
const FIRST_EVENT_SEQUENCE = 1;
const PROCESSED_COMMAND_PRIMARY_KEY_CONSTRAINT = 'processed_commands_pkey';

interface Input {
  database: Database;
  findProcessedCommand(
    commandId: string
  ): Promise<ProcessedCommandIdentity | null>;
  game: CreateStoredGameInput;
}

export async function createGame(
  input: Input
): Promise<CreateStoredGameResult> {
  validateRequestHash(input.game.requestHash);
  validateCreatedEvent(input.game.event);

  try {
    return await input.database.transaction(async (transaction) => {
      const [storedCommand] = await transaction
        .select({
          commandType: processedCommands.commandType,
          gameId: processedCommands.gameId,
          requestHash: processedCommands.requestHash,
          userId: processedCommands.userId,
        })
        .from(processedCommands)
        .where(eq(processedCommands.id, input.game.commandId))
        .limit(1);
      const existingCommand = storedCommand ?? null;

      if (existingCommand !== null) {
        return classifyCreateCommand(existingCommand, input.game);
      }

      const [createdGame] = await transaction
        .insert(games)
        .values({
          currentVersion: input.game.event.sequence,
          status: 'waiting',
        })
        .returning({ createdAt: games.createdAt, id: games.id });

      if (createdGame === undefined) {
        throw new Error('Created game id was not returned.');
      }

      await transaction.insert(processedCommands).values({
        commandType: CREATE_GAME_COMMAND_TYPE,
        gameId: createdGame.id,
        id: input.game.commandId,
        requestHash: input.game.requestHash,
        userId: input.game.creatorUserId,
      });
      await transaction.insert(gameEvents).values({
        commandId: input.game.commandId,
        gameId: createdGame.id,
        payload: input.game.event.payload,
        sequence: input.game.event.sequence,
        type: input.game.event.type,
        version: input.game.event.version,
      });

      return {
        createdAt: createdGame.createdAt,
        gameId: createdGame.id,
        status: 'created',
      };
    });
  } catch (error) {
    if (!isProcessedCommandUniqueViolation(error)) {
      throw error;
    }

    const existingCommand = await input.findProcessedCommand(
      input.game.commandId
    );

    if (existingCommand === null) {
      throw error;
    }

    return classifyCreateCommand(existingCommand, input.game);
  }
}

function classifyCreateCommand(
  existingCommand: ProcessedCommandIdentity,
  input: CreateStoredGameInput
): CreateStoredGameResult {
  const isExactDuplicate =
    existingCommand.userId === input.creatorUserId &&
    existingCommand.commandType === CREATE_GAME_COMMAND_TYPE &&
    existingCommand.requestHash === input.requestHash;

  return isExactDuplicate
    ? { gameId: existingCommand.gameId, status: 'duplicateCommand' }
    : { status: 'commandIdConflict' };
}

function validateCreatedEvent(input: CreateStoredGameInput['event']): void {
  if (input.sequence !== FIRST_EVENT_SEQUENCE) {
    throw new Error('GameCreated must have sequence 1.');
  }

  parseGameEventData(input);
}

function isProcessedCommandUniqueViolation(error: unknown): boolean {
  return hasPostgreSqlConstraintViolation(
    error,
    PROCESSED_COMMAND_PRIMARY_KEY_CONSTRAINT
  );
}
