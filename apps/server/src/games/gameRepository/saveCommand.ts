import {
  type Database,
  activeGamePlayers,
  gameEvents,
  gameParticipants,
  games,
  processedCommands,
} from '@war-chest/database';
import { and, eq } from 'drizzle-orm';
import type {
  ProcessedCommandIdentity,
  SaveGameCommandInput,
  SaveGameCommandResult,
  StoredGame,
} from './GameRepositoryTypes.js';
import {
  validateEventSequence,
  validateExpectedVersion,
  validateNonEmptyEvents,
  validateRequestHash,
} from './gameRepositoryValidation.js';
import { hasPostgreSqlConstraintViolation } from './hasPostgreSqlConstraintViolation.js';

const ACTIVE_GAME_PLAYERS_PRIMARY_KEY_CONSTRAINT = 'active_game_players_pkey';
const PROCESSED_COMMAND_PRIMARY_KEY_CONSTRAINT = 'processed_commands_pkey';
const TEMPORARY_SWAP_SEAT = 2_147_483_647;

interface Input {
  database: Database;
  findGame(gameId: string): Promise<StoredGame | null>;
  findProcessedCommand(
    commandId: string
  ): Promise<ProcessedCommandIdentity | null>;
  gameCommand: SaveGameCommandInput;
}

export async function saveCommand(
  input: Input
): Promise<SaveGameCommandResult> {
  validateRequestHash(input.gameCommand.requestHash);
  validateExpectedVersion(input.gameCommand.expectedVersion);
  validateNonEmptyEvents(input.gameCommand.events);

  try {
    return await input.database.transaction(async (transaction) => {
      const [storedGame] = await transaction
        .select({ currentVersion: games.currentVersion })
        .from(games)
        .where(eq(games.id, input.gameCommand.gameId))
        .limit(1)
        .for('update');

      if (storedGame === undefined) {
        throw new Error(`Game ${input.gameCommand.gameId} does not exist.`);
      }

      const [storedCommand] = await transaction
        .select({
          commandType: processedCommands.commandType,
          gameId: processedCommands.gameId,
          requestHash: processedCommands.requestHash,
          userId: processedCommands.userId,
        })
        .from(processedCommands)
        .where(eq(processedCommands.id, input.gameCommand.commandId))
        .limit(1);
      const existingCommand = storedCommand ?? null;

      if (existingCommand !== null) {
        if (isSameCommand(existingCommand, input.gameCommand)) {
          return {
            currentVersion: storedGame.currentVersion,
            status: 'duplicateCommand',
          };
        }

        return { status: 'commandIdConflict' };
      }

      if (input.gameCommand.expectedVersion !== storedGame.currentVersion) {
        return {
          currentVersion: storedGame.currentVersion,
          status: 'versionConflict',
        };
      }

      validateEventSequence(
        input.gameCommand.events,
        storedGame.currentVersion
      );

      await transaction.insert(processedCommands).values({
        commandType: input.gameCommand.commandType,
        gameId: input.gameCommand.gameId,
        id: input.gameCommand.commandId,
        requestHash: input.gameCommand.requestHash,
        userId: input.gameCommand.userId,
      });
      await transaction.insert(gameEvents).values(
        input.gameCommand.events.map((event) => ({
          commandId: input.gameCommand.commandId,
          gameId: input.gameCommand.gameId,
          payload: event.payload,
          sequence: event.sequence,
          type: event.type,
          version: event.version,
        }))
      );

      await applyParticipantChanges();

      async function applyParticipantChanges(): Promise<void> {
        const participantChanges = input.gameCommand.participantChanges ?? [];

        for (const change of participantChanges) {
          if (change.operation === 'addPlayer') {
            await transaction.insert(activeGamePlayers).values({
              gameId: input.gameCommand.gameId,
              userId: change.userId,
            });
            await transaction.insert(gameParticipants).values({
              gameId: input.gameCommand.gameId,
              seat: change.seat,
              team: change.team,
              userId: change.userId,
            });
          } else if (change.operation === 'movePlayer') {
            await transaction
              .update(gameParticipants)
              .set({ seat: change.seat, team: change.team })
              .where(
                and(
                  eq(gameParticipants.gameId, input.gameCommand.gameId),
                  eq(gameParticipants.userId, change.userId)
                )
              );
          } else if (change.operation === 'removePlayer') {
            await transaction
              .delete(activeGamePlayers)
              .where(
                and(
                  eq(activeGamePlayers.gameId, input.gameCommand.gameId),
                  eq(activeGamePlayers.userId, change.userId)
                )
              );
            await transaction
              .delete(gameParticipants)
              .where(
                and(
                  eq(gameParticipants.gameId, input.gameCommand.gameId),
                  eq(gameParticipants.userId, change.userId)
                )
              );
          } else {
            const [firstPosition, secondPosition] = change.positions;

            await transaction
              .update(gameParticipants)
              .set({ seat: TEMPORARY_SWAP_SEAT })
              .where(
                and(
                  eq(gameParticipants.gameId, input.gameCommand.gameId),
                  eq(gameParticipants.userId, firstPosition.userId)
                )
              );
            await transaction
              .update(gameParticipants)
              .set({ seat: secondPosition.seat, team: secondPosition.team })
              .where(
                and(
                  eq(gameParticipants.gameId, input.gameCommand.gameId),
                  eq(gameParticipants.userId, secondPosition.userId)
                )
              );
            await transaction
              .update(gameParticipants)
              .set({ seat: firstPosition.seat, team: firstPosition.team })
              .where(
                and(
                  eq(gameParticipants.gameId, input.gameCommand.gameId),
                  eq(gameParticipants.userId, firstPosition.userId)
                )
              );
          }
        }
      }

      const lastEvent = input.gameCommand.events.at(-1);

      if (lastEvent === undefined) {
        throw new Error('A saved command must contain at least one event.');
      }

      await transaction
        .update(games)
        .set({
          ...input.gameCommand.gameChanges,
          currentVersion: lastEvent.sequence,
        })
        .where(eq(games.id, input.gameCommand.gameId));

      if (input.gameCommand.gameChanges?.status === 'finished') {
        await transaction
          .delete(activeGamePlayers)
          .where(eq(activeGamePlayers.gameId, input.gameCommand.gameId));
      }

      return { currentVersion: lastEvent.sequence, status: 'saved' };
    });
  } catch (error) {
    if (isActiveGamePlayerUniqueViolation(error)) {
      return { status: 'playerAlreadyInGame' };
    }

    if (!isProcessedCommandUniqueViolation(error)) {
      throw error;
    }

    return classifyConcurrentCommand(input, error);
  }
}

async function classifyConcurrentCommand(
  input: Input,
  originalError: unknown
): Promise<SaveGameCommandResult> {
  const existingCommand = await input.findProcessedCommand(
    input.gameCommand.commandId
  );

  if (existingCommand === null) {
    throw originalError;
  }

  if (!isSameCommand(existingCommand, input.gameCommand)) {
    return { status: 'commandIdConflict' };
  }

  const storedGame = await input.findGame(input.gameCommand.gameId);

  if (storedGame === null) {
    throw originalError;
  }

  return {
    currentVersion: storedGame.currentVersion,
    status: 'duplicateCommand',
  };
}

function isSameCommand(
  existingCommand: ProcessedCommandIdentity,
  input: SaveGameCommandInput
): boolean {
  return (
    existingCommand.gameId === input.gameId &&
    existingCommand.userId === input.userId &&
    existingCommand.commandType === input.commandType &&
    existingCommand.requestHash === input.requestHash
  );
}

function isProcessedCommandUniqueViolation(error: unknown): boolean {
  return hasPostgreSqlConstraintViolation(
    error,
    PROCESSED_COMMAND_PRIMARY_KEY_CONSTRAINT
  );
}

function isActiveGamePlayerUniqueViolation(error: unknown): boolean {
  return hasPostgreSqlConstraintViolation(
    error,
    ACTIVE_GAME_PLAYERS_PRIMARY_KEY_CONSTRAINT
  );
}
