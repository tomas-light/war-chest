import type {
  FakeDatabaseConnection,
  FakeDatabaseSchema,
  FakeFeatureFlags,
  FakeGame,
  FakeGameEvent,
  FakeGameParticipant,
  FakeProcessedCommand,
  JsonValue,
} from '../schema.js';
import {
  type SchemaTable,
  createSchemaTable,
  runSchemaTableTransaction,
} from '../table.js';

const FIRST_EVENT_SEQUENCE = 1;
const MAX_INDEXED_DB_RESULT_COUNT = 4_294_967_295;

export interface FakeGameChanges {
  events: readonly FakeGameEvent[];
  game: FakeGame;
  participants?: readonly FakeGameParticipant[];
  processedCommand?: FakeProcessedCommand;
}

export interface FakeGameRepository {
  findProcessedCommand(commandId: string): Promise<FakeProcessedCommand | null>;
  getById(gameId: string): Promise<FakeGame | null>;
  getEvents(
    gameId: string,
    afterSequence?: number,
    limit?: number
  ): Promise<FakeGameEvent[]>;
  getParticipant(
    gameId: string,
    userId: string
  ): Promise<FakeGameParticipant | null>;
  listGamesForUser(userId: string): Promise<FakeGame[]>;
  listParticipants(gameId: string): Promise<FakeGameParticipant[]>;
  replaceFeatureFlags(
    gameId: string,
    featureFlags: FakeFeatureFlags
  ): Promise<boolean>;
  saveChanges(changes: FakeGameChanges): Promise<void>;
}

export function createFakeGameRepository(
  database: FakeDatabaseConnection
): FakeGameRepository {
  const gameTable = createSchemaTable(database, 'games');
  const gameEventTable = createSchemaTable(database, 'gameEvents');
  const gameEventSequenceIndex = gameEventTable.index('by-game-sequence');
  const gameParticipantTable = createSchemaTable(database, 'gameParticipants');
  const processedCommandTable = createSchemaTable(
    database,
    'processedCommands'
  );

  return {
    findProcessedCommand,
    getById,
    getEvents,
    getParticipant,
    listGamesForUser,
    listParticipants,
    replaceFeatureFlags,
    saveChanges,
  };

  async function findProcessedCommand(
    commandId: string
  ): Promise<FakeProcessedCommand | null> {
    return (await processedCommandTable.get(commandId)) ?? null;
  }

  async function getById(gameId: string): Promise<FakeGame | null> {
    return (await gameTable.get(gameId)) ?? null;
  }

  async function getEvents(
    gameId: string,
    afterSequence = 0,
    limit = MAX_INDEXED_DB_RESULT_COUNT
  ): Promise<FakeGameEvent[]> {
    if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) {
      throw new Error('afterSequence must be a non-negative safe integer.');
    }

    if (
      !Number.isSafeInteger(limit) ||
      limit <= 0 ||
      limit > MAX_INDEXED_DB_RESULT_COUNT
    ) {
      throw new Error('limit must be a positive unsigned 32-bit integer.');
    }

    const range = IDBKeyRange.bound(
      [gameId, afterSequence + 1],
      [gameId, Number.MAX_SAFE_INTEGER]
    );
    return gameEventSequenceIndex.getAll(range, limit);
  }

  async function getParticipant(
    gameId: string,
    userId: string
  ): Promise<FakeGameParticipant | null> {
    return (await gameParticipantTable.get([gameId, userId])) ?? null;
  }

  async function listGamesForUser(userId: string): Promise<FakeGame[]> {
    const participants = await gameParticipantTable.getAll();
    const gameIds = new Set(
      participants
        .filter((participant) => participant.userId === userId)
        .map((participant) => participant.gameId)
    );
    const games = await gameTable.getAll();
    return games
      .filter((game) => gameIds.has(game.id))
      .sort(compareGamesByNewestDate);
  }

  async function listParticipants(
    gameId: string
  ): Promise<FakeGameParticipant[]> {
    const participants = await gameParticipantTable.getAll();
    return participants
      .filter((participant) => participant.gameId === gameId)
      .sort(compareParticipantsBySeat);
  }

  async function replaceFeatureFlags(
    gameId: string,
    featureFlags: FakeFeatureFlags
  ): Promise<boolean> {
    return runSchemaTableTransaction(
      database,
      ['gameEvents'],
      async (transaction) => {
        const gameEvents = transaction.table('gameEvents');
        const gameCreatedEvent = await gameEvents
          .index('by-game-sequence')
          .get([gameId, FIRST_EVENT_SEQUENCE]);

        if (
          gameCreatedEvent === undefined ||
          gameCreatedEvent.type !== 'GameCreated' ||
          !isJsonObject(gameCreatedEvent.payload)
        ) {
          return false;
        }

        await gameEvents.update(gameCreatedEvent.id, {
          ...gameCreatedEvent,
          payload: {
            ...gameCreatedEvent.payload,
            featureFlags: { ...featureFlags },
          },
        });
        return true;
      }
    );
  }

  async function saveChanges(changes: FakeGameChanges): Promise<void> {
    validateGameChanges(changes);

    await runSchemaTableTransaction(
      database,
      ['games', 'gameParticipants', 'processedCommands', 'gameEvents'],
      async (transaction) => {
        const games = transaction.table('games');
        const gameParticipants = transaction.table('gameParticipants');
        const processedCommands = transaction.table('processedCommands');
        const gameEvents = transaction.table('gameEvents');

        await validateParticipantSeats(
          gameParticipants,
          changes.game.id,
          changes.participants ?? []
        );

        if ((await games.get(changes.game.id)) === undefined) {
          await games.insert(changes.game.id, changes.game);
        } else {
          await games.update(changes.game.id, changes.game);
        }

        for (const participant of changes.participants ?? []) {
          const participantKey: [string, string] = [
            participant.gameId,
            participant.userId,
          ];
          if ((await gameParticipants.get(participantKey)) === undefined) {
            await gameParticipants.insert(participantKey, participant);
          } else {
            await gameParticipants.update(participantKey, participant);
          }
        }

        if (changes.processedCommand !== undefined) {
          await processedCommands.insert(
            changes.processedCommand.id,
            changes.processedCommand
          );
        }

        for (const event of changes.events) {
          await gameEvents.insert(event.id, event);
        }
      }
    );
  }
}

function validateGameChanges(changes: FakeGameChanges): void {
  const records = [
    ...(changes.participants ?? []),
    ...(changes.processedCommand === undefined
      ? []
      : [changes.processedCommand]),
    ...changes.events,
  ];

  if (records.some((record) => record.gameId !== changes.game.id)) {
    throw new Error('All fake game changes must belong to the saved game.');
  }

  const commandId = changes.processedCommand?.id;
  if (
    commandId !== undefined &&
    changes.events.some((event) => event.commandId !== commandId)
  ) {
    throw new Error(
      'Every command event must reference the processed command.'
    );
  }
}

async function validateParticipantSeats(
  gameParticipantTable: SchemaTable<FakeDatabaseSchema, 'gameParticipants'>,
  gameId: string,
  changedParticipants: readonly FakeGameParticipant[]
): Promise<void> {
  const changedUserIds = new Set(
    changedParticipants.map((participant) => participant.userId)
  );
  const storedParticipants = await gameParticipantTable.getAll();
  const participants = [
    ...storedParticipants.filter(
      (participant) =>
        participant.gameId === gameId && !changedUserIds.has(participant.userId)
    ),
    ...changedParticipants,
  ];
  const occupiedSeats = new Set<number>();

  for (const participant of participants) {
    if (participant.role === 'spectator') {
      if (participant.seat !== null) {
        throw new Error('A fake spectator cannot occupy a player seat.');
      }

      continue;
    }

    if (participant.seat === null || participant.seat <= 0) {
      throw new Error('A fake player must occupy a positive seat.');
    }

    if (occupiedSeats.has(participant.seat)) {
      throw new Error('A fake player seat must be unique within a game.');
    }

    occupiedSeats.add(participant.seat);
  }
}

function compareGamesByNewestDate(firstGame: FakeGame, secondGame: FakeGame) {
  const firstDate = firstGame.finishedAt ?? firstGame.createdAt;
  const secondDate = secondGame.finishedAt ?? secondGame.createdAt;
  return secondDate.getTime() - firstDate.getTime();
}

function compareParticipantsBySeat(
  firstParticipant: FakeGameParticipant,
  secondParticipant: FakeGameParticipant
) {
  return (
    (firstParticipant.seat ?? Number.MAX_SAFE_INTEGER) -
    (secondParticipant.seat ?? Number.MAX_SAFE_INTEGER)
  );
}

function isJsonObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
