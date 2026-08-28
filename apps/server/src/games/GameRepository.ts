import {
  type Database,
  type Game,
  type GameParticipant,
  activeGamePlayers,
  gameEvents,
  gameParticipants,
  games,
  processedCommands,
  userAvatars,
  users,
} from '@war-chest/database';
import {
  type GameCreatedEventData,
  type GameEventData,
  parseGameEventData,
} from '@war-chest/game-engine';
import { and, asc, desc, eq, gt, inArray, or } from 'drizzle-orm';

const CREATE_GAME_COMMAND_TYPE = 'CreateGame';
const FIRST_EVENT_SEQUENCE = 1;
const ACTIVE_GAME_PLAYERS_PRIMARY_KEY_CONSTRAINT = 'active_game_players_pkey';
const POSTGRESQL_UNIQUE_VIOLATION_SQLSTATE = '23505';
const PROCESSED_COMMAND_PRIMARY_KEY_CONSTRAINT = 'processed_commands_pkey';
const REQUEST_HASH_PATTERN = /^[0-9a-f]{64}$/;

type GameTeam = NonNullable<GameParticipant['team']>;

interface StoredGame {
  createdAt: Date;
  currentVersion: number;
  finishedAt: Date | null;
  id: string;
  startedAt: Date | null;
  status: Game['status'];
  winnerTeam: Game['winnerTeam'];
}

export interface StoredParticipant {
  gameId: string;
  seat: number;
  team: GameParticipant['team'];
  userId: string;
}

interface StoredLobbyPlayer {
  avatarHash: string | null;
  displayName: string;
  id: string;
  seat: number;
  team: GameTeam;
}

export interface StoredLobbyGame {
  createdAt: Date;
  id: string;
  players: readonly StoredLobbyPlayer[];
  startedAt: Date | null;
  status: 'active' | 'waiting';
}

interface ProcessedCommandIdentity {
  commandType: string;
  gameId: string;
  requestHash: string;
  userId: string;
}

interface GameProjectionChanges {
  finishedAt?: Date | null;
  startedAt?: Date | null;
  status?: Game['status'];
  winnerTeam?: Game['winnerTeam'];
}

type ParticipantProjectionChange =
  | {
      operation: 'addPlayer';
      seat: number;
      team: GameTeam;
      userId: string;
    }
  | {
      operation: 'movePlayer';
      seat: number;
      team: GameTeam;
      userId: string;
    }
  | {
      operation: 'swapPlayers';
      positions: [
        { seat: number; team: GameTeam; userId: string },
        { seat: number; team: GameTeam; userId: string },
      ];
    };

interface CreateStoredGameInput {
  commandId: string;
  creatorUserId: string;
  event: GameCreatedEventData;
  requestHash: string;
}

type CreateStoredGameResult =
  | { gameId: string; status: 'created' }
  | { gameId: string; status: 'duplicateCommand' }
  | { status: 'commandIdConflict' };

interface SaveGameCommandInput {
  commandId: string;
  commandType: string;
  events: readonly GameEventData[];
  expectedVersion: number;
  gameChanges?: GameProjectionChanges;
  gameId: string;
  participantChanges?: readonly ParticipantProjectionChange[];
  requestHash: string;
  userId: string;
}

type SaveGameCommandResult =
  | { currentVersion: number; status: 'saved' }
  | { currentVersion: number; status: 'duplicateCommand' }
  | { currentVersion: number; status: 'versionConflict' }
  | { status: 'commandIdConflict' }
  | { status: 'playerAlreadyInGame' };

interface SaveSystemEventsInput {
  events: readonly GameEventData[];
  expectedVersion: number;
  gameChanges?: GameProjectionChanges;
  gameId: string;
}

type SaveSystemEventsResult =
  | { currentVersion: number; status: 'saved' }
  | { currentVersion: number; status: 'versionConflict' };

export interface GameRepository {
  createGame(
    this: void,
    input: CreateStoredGameInput
  ): Promise<CreateStoredGameResult>;
  findGame(this: void, gameId: string): Promise<StoredGame | null>;
  findCurrentPlayerGame(this: void, userId: string): Promise<string | null>;
  findActiveGameIds(this: void): Promise<readonly string[]>;
  listLobbyGames(this: void): Promise<readonly StoredLobbyGame[]>;
  findParticipant(
    this: void,
    gameId: string,
    userId: string
  ): Promise<StoredParticipant | null>;
  findProcessedCommand(
    this: void,
    commandId: string
  ): Promise<ProcessedCommandIdentity | null>;
  loadEvents(
    this: void,
    gameId: string,
    afterSequence?: number
  ): Promise<readonly GameEventData[]>;
  saveCommand(
    this: void,
    input: SaveGameCommandInput
  ): Promise<SaveGameCommandResult>;
  saveSystemEvents(
    this: void,
    input: SaveSystemEventsInput
  ): Promise<SaveSystemEventsResult>;
}

export function createGameRepository(database: Database): GameRepository {
  return {
    createGame,
    findCurrentPlayerGame,
    findActiveGameIds,
    findGame,
    findParticipant,
    findProcessedCommand,
    listLobbyGames,
    loadEvents,
    saveCommand,
    saveSystemEvents,
  };

  async function createGame(
    input: CreateStoredGameInput
  ): Promise<CreateStoredGameResult> {
    validateRequestHash(input.requestHash);
    validateCreatedEvent(input.event);

    try {
      return await database.transaction(async (transaction) => {
        const [storedCommand] = await transaction
          .select({
            commandType: processedCommands.commandType,
            gameId: processedCommands.gameId,
            requestHash: processedCommands.requestHash,
            userId: processedCommands.userId,
          })
          .from(processedCommands)
          .where(eq(processedCommands.id, input.commandId))
          .limit(1);
        const existingCommand = storedCommand ?? null;

        if (existingCommand !== null) {
          return classifyCreateCommand(existingCommand, input);
        }

        const [createdGame] = await transaction
          .insert(games)
          .values({
            currentVersion: input.event.sequence,
            status: 'waiting',
          })
          .returning({ id: games.id });

        if (createdGame === undefined) {
          throw new Error('Created game id was not returned.');
        }

        await transaction.insert(processedCommands).values({
          commandType: CREATE_GAME_COMMAND_TYPE,
          gameId: createdGame.id,
          id: input.commandId,
          requestHash: input.requestHash,
          userId: input.creatorUserId,
        });
        await transaction.insert(gameEvents).values({
          commandId: input.commandId,
          gameId: createdGame.id,
          payload: input.event.payload,
          sequence: input.event.sequence,
          type: input.event.type,
          version: input.event.version,
        });

        return { gameId: createdGame.id, status: 'created' };
      });
    } catch (error) {
      if (!isProcessedCommandUniqueViolation(error)) {
        throw error;
      }

      const existingCommand = await findProcessedCommand(input.commandId);

      if (existingCommand === null) {
        throw error;
      }

      return classifyCreateCommand(existingCommand, input);
    }
  }

  async function findGame(gameId: string): Promise<StoredGame | null> {
    const [game] = await database
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1);

    return game ?? null;
  }

  async function findCurrentPlayerGame(userId: string): Promise<string | null> {
    const [activeGame] = await database
      .select({ gameId: activeGamePlayers.gameId })
      .from(activeGamePlayers)
      .where(eq(activeGamePlayers.userId, userId))
      .limit(1);

    return activeGame?.gameId ?? null;
  }

  async function findActiveGameIds(): Promise<readonly string[]> {
    const activeGames = await database
      .select({ id: games.id })
      .from(games)
      .where(eq(games.status, 'active'));

    return activeGames.map((game) => game.id);
  }

  async function listLobbyGames(): Promise<readonly StoredLobbyGame[]> {
    const gameRows = await database
      .select({
        createdAt: games.createdAt,
        id: games.id,
        startedAt: games.startedAt,
        status: games.status,
      })
      .from(games)
      .where(or(eq(games.status, 'waiting'), eq(games.status, 'active')))
      .orderBy(desc(games.createdAt));
    const gameIds = gameRows.map((game) => game.id);

    if (gameIds.length === 0) {
      return [];
    }

    const playerRows = await database
      .select({
        avatarHash: userAvatars.contentHash,
        displayName: users.displayName,
        gameId: gameParticipants.gameId,
        id: users.id,
        seat: gameParticipants.seat,
        team: gameParticipants.team,
      })
      .from(gameParticipants)
      .innerJoin(users, eq(users.id, gameParticipants.userId))
      .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
      .where(inArray(gameParticipants.gameId, gameIds))
      .orderBy(
        asc(gameParticipants.gameId),
        asc(gameParticipants.team),
        asc(gameParticipants.seat)
      );
    const playersByGameId = new Map<string, StoredLobbyPlayer[]>();

    for (const player of playerRows) {
      const players = playersByGameId.get(player.gameId) ?? [];
      const { gameId, ...storedPlayer } = player;

      players.push(storedPlayer);
      playersByGameId.set(gameId, players);
    }

    return gameRows.map((game) => ({
      ...game,
      players: playersByGameId.get(game.id) ?? [],
      status: requireLobbyGameStatus(game.status, game.id),
    }));
  }

  async function findParticipant(
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

  async function findProcessedCommand(
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

  async function loadEvents(
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
        and(
          eq(gameEvents.gameId, gameId),
          gt(gameEvents.sequence, afterSequence)
        )
      )
      .orderBy(asc(gameEvents.sequence));

    return rows.map((row) => parseStoredEvent(row, gameId));
  }

  async function saveCommand(
    input: SaveGameCommandInput
  ): Promise<SaveGameCommandResult> {
    validateRequestHash(input.requestHash);
    validateExpectedVersion(input.expectedVersion);
    validateNonEmptyEvents(input.events);

    try {
      return await database.transaction(async (transaction) => {
        const [storedGame] = await transaction
          .select({ currentVersion: games.currentVersion })
          .from(games)
          .where(eq(games.id, input.gameId))
          .limit(1)
          .for('update');

        if (storedGame === undefined) {
          throw new Error(`Game ${input.gameId} does not exist.`);
        }

        const [storedCommand] = await transaction
          .select({
            commandType: processedCommands.commandType,
            gameId: processedCommands.gameId,
            requestHash: processedCommands.requestHash,
            userId: processedCommands.userId,
          })
          .from(processedCommands)
          .where(eq(processedCommands.id, input.commandId))
          .limit(1);
        const existingCommand = storedCommand ?? null;

        if (existingCommand !== null) {
          if (isSameCommand(existingCommand, input)) {
            return {
              currentVersion: storedGame.currentVersion,
              status: 'duplicateCommand',
            };
          }

          return { status: 'commandIdConflict' };
        }

        if (input.expectedVersion !== storedGame.currentVersion) {
          return {
            currentVersion: storedGame.currentVersion,
            status: 'versionConflict',
          };
        }

        validateEventSequence(input.events, storedGame.currentVersion);

        await transaction.insert(processedCommands).values({
          commandType: input.commandType,
          gameId: input.gameId,
          id: input.commandId,
          requestHash: input.requestHash,
          userId: input.userId,
        });
        await transaction.insert(gameEvents).values(
          input.events.map((event) => ({
            commandId: input.commandId,
            gameId: input.gameId,
            payload: event.payload,
            sequence: event.sequence,
            type: event.type,
            version: event.version,
          }))
        );

        const participantChanges = input.participantChanges ?? [];

        for (const change of participantChanges) {
          if (change.operation === 'addPlayer') {
            await transaction.insert(activeGamePlayers).values({
              gameId: input.gameId,
              userId: change.userId,
            });
            await transaction.insert(gameParticipants).values({
              gameId: input.gameId,
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
                  eq(gameParticipants.gameId, input.gameId),
                  eq(gameParticipants.userId, change.userId)
                )
              );
          } else {
            const [firstPosition, secondPosition] = change.positions;
            const temporarySeat = 2_147_483_647;

            await transaction
              .update(gameParticipants)
              .set({ seat: temporarySeat })
              .where(
                and(
                  eq(gameParticipants.gameId, input.gameId),
                  eq(gameParticipants.userId, firstPosition.userId)
                )
              );
            await transaction
              .update(gameParticipants)
              .set({
                seat: secondPosition.seat,
                team: secondPosition.team,
              })
              .where(
                and(
                  eq(gameParticipants.gameId, input.gameId),
                  eq(gameParticipants.userId, secondPosition.userId)
                )
              );
            await transaction
              .update(gameParticipants)
              .set({ seat: firstPosition.seat, team: firstPosition.team })
              .where(
                and(
                  eq(gameParticipants.gameId, input.gameId),
                  eq(gameParticipants.userId, firstPosition.userId)
                )
              );
          }
        }

        const lastEvent = input.events.at(-1);

        if (lastEvent === undefined) {
          throw new Error('A saved command must contain at least one event.');
        }

        await transaction
          .update(games)
          .set({
            ...input.gameChanges,
            currentVersion: lastEvent.sequence,
          })
          .where(eq(games.id, input.gameId));

        if (input.gameChanges?.status === 'finished') {
          await transaction
            .delete(activeGamePlayers)
            .where(eq(activeGamePlayers.gameId, input.gameId));
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

      const existingCommand = await findProcessedCommand(input.commandId);

      if (existingCommand === null) {
        throw error;
      }

      if (!isSameCommand(existingCommand, input)) {
        return { status: 'commandIdConflict' };
      }

      const storedGame = await findGame(input.gameId);

      if (storedGame === null) {
        throw error;
      }

      return {
        currentVersion: storedGame.currentVersion,
        status: 'duplicateCommand',
      };
    }
  }

  async function saveSystemEvents(
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
        .set({
          ...input.gameChanges,
          currentVersion: lastEvent.sequence,
        })
        .where(eq(games.id, input.gameId));

      if (input.gameChanges?.status === 'finished') {
        await transaction
          .delete(activeGamePlayers)
          .where(eq(activeGamePlayers.gameId, input.gameId));
      }

      return { currentVersion: lastEvent.sequence, status: 'saved' };
    });
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

function validateCreatedEvent(event: GameCreatedEventData): void {
  if (event.sequence !== FIRST_EVENT_SEQUENCE) {
    throw new Error('GameCreated must have sequence 1.');
  }

  parseGameEventData(event);
}

function requireLobbyGameStatus(
  status: Game['status'],
  gameId: string
): StoredLobbyGame['status'] {
  if (status === 'finished') {
    throw new Error(`Finished game ${gameId} cannot appear in the lobby.`);
  }

  return status;
}

function validateEventSequence(
  events: readonly GameEventData[],
  currentVersion: number
): void {
  for (const [index, event] of events.entries()) {
    const expectedSequence = currentVersion + index + 1;

    if (event.sequence !== expectedSequence) {
      throw new Error(
        `Event sequence ${event.sequence} does not follow ${currentVersion}.`
      );
    }
  }
}

function validateNonEmptyEvents(events: readonly GameEventData[]): void {
  if (events.length === 0) {
    throw new Error('A saved command must contain at least one event.');
  }
}

function validateRequestHash(requestHash: string): void {
  if (!REQUEST_HASH_PATTERN.test(requestHash)) {
    throw new Error('requestHash must be a lowercase SHA-256 hash.');
  }
}

function validateAfterSequence(afterSequence: number): void {
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) {
    throw new Error('afterSequence must be a non-negative safe integer.');
  }
}

function validateExpectedVersion(expectedVersion: number): void {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    throw new Error('expectedVersion must be a non-negative safe integer.');
  }
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

function hasPostgreSqlConstraintViolation(
  error: unknown,
  constraintName: string
): boolean {
  const checkedErrors = new Set<unknown>();
  let currentError = error;

  while (
    currentError !== null &&
    typeof currentError === 'object' &&
    !checkedErrors.has(currentError)
  ) {
    if (
      'code' in currentError &&
      currentError.code === POSTGRESQL_UNIQUE_VIOLATION_SQLSTATE &&
      'constraint_name' in currentError &&
      currentError.constraint_name === constraintName
    ) {
      return true;
    }

    checkedErrors.add(currentError);
    currentError = 'cause' in currentError ? currentError.cause : null;
  }

  return false;
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
