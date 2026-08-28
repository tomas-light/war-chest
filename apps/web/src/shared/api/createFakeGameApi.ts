import type {
  CreateGameRequest,
  GameResponse,
  JoinGameRequest,
  LobbyGame,
  LobbyGamesResponse,
  StartGameRequest,
  SwapPlayerPositionsRequest,
} from '@war-chest/api-contracts';
import type {
  FakeGame,
  FakeGameEvent,
  FakeGameParticipant,
  FakeProcessedCommand,
} from '@war-chest/fake-database';
import {
  type GameCommandData,
  type GameEventData,
  type GameState,
  type Viewer,
  applyEvent,
  createGame as createGameEvent,
  createViewFor,
  decide,
  parseGameEventData,
  restoreGame,
} from '@war-chest/game-engine';
import { publishFakeLobbyUpdate } from './fakeLobbyUpdates';
import type { GameApi } from './GameApi';
import { getFakeDatabase } from './getFakeDatabase';

interface ExecuteCommandInput {
  command: GameCommandData;
  commandId: string;
  expectedVersion: number;
  gameId: string;
}

interface CreateStoredEventInput {
  commandId: string;
  createdAt: Date;
  event: GameEventData;
  gameId: string;
}

export function createFakeGameApi(userId: string): GameApi {
  return {
    createGame,
    getGame,
    joinGame,
    listLobbyGames,
    startGame,
    swapPlayerPositions,
  };

  async function createGame(request: CreateGameRequest): Promise<GameResponse> {
    const database = await getFakeDatabase();
    const requestHash = await createRequestHash({
      operation: 'CreateGame',
      userId,
    });
    const existingCommand = await database.games.findProcessedCommand(
      request.commandId
    );

    if (existingCommand !== null) {
      if (
        existingCommand.commandType !== 'CreateGame' ||
        existingCommand.requestHash !== requestHash ||
        existingCommand.userId !== userId
      ) {
        throw new Error('Идентификатор команды уже использован.');
      }

      return getGame(existingCommand.gameId);
    }

    const currentPlayerGame =
      await database.games.findCurrentPlayerGame(userId);

    if (currentPlayerGame !== null) {
      throw new Error('Сначала завершите текущую игру.');
    }

    const gameCreatedEvent = createGameEvent({
      creatorId: userId,
      featureFlags: await database.featureFlags.getApplication(),
      type: 'CreateGame',
    });
    const createdAt = new Date();
    const gameId = crypto.randomUUID();
    const state = applyEvent(null, gameCreatedEvent);
    const processedCommand: FakeProcessedCommand = {
      commandType: 'CreateGame',
      gameId,
      id: request.commandId,
      processedAt: createdAt,
      requestHash,
      userId,
    };
    const game: FakeGame = {
      createdAt,
      currentVersion: state.lastEventSequence,
      finishedAt: null,
      id: gameId,
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };

    await database.games.saveChanges({
      events: [
        createStoredEvent({
          commandId: request.commandId,
          createdAt,
          event: gameCreatedEvent,
          gameId,
        }),
      ],
      game,
      processedCommand,
    });
    publishFakeLobbyUpdate({ gameId });

    return {
      gameId,
      view: createViewFor(state, { role: 'spectator' }),
    };
  }

  async function getGame(gameId: string): Promise<GameResponse> {
    const database = await getFakeDatabase();
    const game = await database.games.getById(gameId);

    if (game === null) {
      throw new Error('Игра не найдена.');
    }

    const state = await loadGameState(gameId);
    const participant = await database.games.getParticipant(gameId, userId);
    const viewer: Viewer =
      participant === null ? { role: 'spectator' } : getPlayerViewer(userId);

    return { gameId, view: createViewFor(state, viewer) };
  }

  function joinGame(
    gameId: string,
    request: JoinGameRequest
  ): Promise<GameResponse> {
    return executeCommand({
      command: { seat: request.seat, team: request.team, type: 'JoinGame' },
      commandId: request.commandId,
      expectedVersion: request.expectedVersion,
      gameId,
    });
  }

  async function listLobbyGames(): Promise<LobbyGamesResponse> {
    const database = await getFakeDatabase();
    const games = (await database.game.getAll())
      .filter((game) => game.status !== 'finished')
      .sort(
        (firstGame, secondGame) =>
          secondGame.createdAt.getTime() - firstGame.createdAt.getTime()
      );
    const items = await Promise.all(games.map(createLobbyGame));

    const currentPlayerGame =
      await database.games.findCurrentPlayerGame(userId);

    return {
      currentPlayerGameId: currentPlayerGame?.id ?? null,
      items,
    };

    async function createLobbyGame(game: FakeGame): Promise<LobbyGame> {
      const participants = await database.games.listParticipants(game.id);
      const players = await Promise.all(
        participants.map(async (participant) => {
          const user = await database.users.getById(participant.userId);

          if (user === null) {
            throw new Error(`Участник ${participant.userId} не найден.`);
          }

          return {
            avatarVersion: null,
            displayName: user.displayName,
            id: user.id,
            seat: participant.seat,
            team: participant.team,
          };
        })
      );

      return {
        createdAt: game.createdAt.toISOString(),
        id: game.id,
        players,
        startedAt: game.startedAt?.toISOString() ?? null,
        status: game.status === 'active' ? 'active' : 'waiting',
      };
    }
  }

  function startGame(
    gameId: string,
    request: StartGameRequest
  ): Promise<GameResponse> {
    return executeCommand({
      command: { type: 'StartGame' },
      commandId: request.commandId,
      expectedVersion: request.expectedVersion,
      gameId,
    });
  }

  function swapPlayerPositions(
    gameId: string,
    request: SwapPlayerPositionsRequest
  ): Promise<GameResponse> {
    return executeCommand({
      command: { type: 'SwapPlayerPositions' },
      commandId: request.commandId,
      expectedVersion: request.expectedVersion,
      gameId,
    });
  }

  async function executeCommand(
    input: ExecuteCommandInput
  ): Promise<GameResponse> {
    const database = await getFakeDatabase();
    const existingCommand = await database.games.findProcessedCommand(
      input.commandId
    );
    const requestHash = await createRequestHash({
      command: input.command,
      expectedVersion: input.expectedVersion,
      gameId: input.gameId,
      userId,
    });

    if (existingCommand !== null) {
      if (
        existingCommand.commandType !== input.command.type ||
        existingCommand.gameId !== input.gameId ||
        existingCommand.requestHash !== requestHash ||
        existingCommand.userId !== userId
      ) {
        throw new Error('Идентификатор команды уже использован.');
      }

      return getGame(input.gameId);
    }

    const game = await database.games.getById(input.gameId);

    if (game === null) {
      throw new Error('Игра не найдена.');
    }

    const state = await loadGameState(input.gameId);

    if (state.lastEventSequence !== input.expectedVersion) {
      throw new Error('Игра уже изменилась. Обновите состояние и повторите.');
    }

    const participant = await database.games.getParticipant(
      input.gameId,
      userId
    );

    if (input.command.type === 'JoinGame' && participant === null) {
      const currentPlayerGame =
        await database.games.findCurrentPlayerGame(userId);

      if (currentPlayerGame !== null && currentPlayerGame.id !== input.gameId) {
        throw new Error(
          'Сначала завершите текущую игру. Другие партии можно только смотреть.'
        );
      }
    }

    if (input.command.type === 'StartGame' && state.creatorId !== userId) {
      throw new Error('Только создатель может запустить игру.');
    }

    if (
      input.command.type === 'SwapPlayerPositions' &&
      state.creatorId !== userId
    ) {
      throw new Error('Только создатель может поменять игроков местами.');
    }

    if (
      input.command.type !== 'JoinGame' &&
      input.command.type !== 'StartGame' &&
      input.command.type !== 'SwapPlayerPositions' &&
      participant === null
    ) {
      throw new Error('Зритель не может выполнить эту команду.');
    }

    const events = decide(state, userId, input.command);

    if (events.length === 0) {
      throw new Error('Команда отклонена правилами игры.');
    }

    const occurredAt = new Date();
    const nextState = events.reduce(applyEvent, state);
    const nextGame: FakeGame = {
      ...game,
      currentVersion: nextState.lastEventSequence,
      startedAt:
        nextState.status === 'active' && game.startedAt === null
          ? occurredAt
          : game.startedAt,
      status: nextState.status,
      winnerTeam: nextState.winnerTeam,
    };
    const changedPlayer = events.find(
      (event) =>
        event.type === 'PlayerJoined' || event.type === 'PlayerPositionChanged'
    );
    const participants: readonly FakeGameParticipant[] =
      changedPlayer?.type === 'PlayerJoined' ||
      changedPlayer?.type === 'PlayerPositionChanged'
        ? [
            {
              gameId: input.gameId,
              seat: changedPlayer.payload.seat,
              team: changedPlayer.payload.team,
              userId: changedPlayer.payload.playerId,
            },
          ]
        : events.flatMap((event) => {
            if (event.type !== 'PlayerPositionsSwapped') {
              return [];
            }

            return event.payload.positions.map((position) => ({
              gameId: input.gameId,
              seat: position.seat,
              team: position.team,
              userId: position.playerId,
            }));
          });
    const processedCommand: FakeProcessedCommand = {
      commandType: input.command.type,
      gameId: input.gameId,
      id: input.commandId,
      processedAt: occurredAt,
      requestHash,
      userId,
    };

    await database.games.saveChanges({
      events: events.map((event) =>
        createStoredEvent({
          commandId: input.commandId,
          createdAt: occurredAt,
          event,
          gameId: input.gameId,
        })
      ),
      game: nextGame,
      participants,
      processedCommand,
    });
    publishFakeLobbyUpdate({ gameId: input.gameId });

    const viewer: Viewer =
      input.command.type === 'JoinGame' || participant !== null
        ? getPlayerViewer(userId)
        : { role: 'spectator' };

    return {
      gameId: input.gameId,
      view: createViewFor(nextState, viewer),
    };
  }

  async function loadGameState(gameId: string): Promise<GameState> {
    const database = await getFakeDatabase();
    const storedEvents = await database.games.getEvents(gameId);
    const state = restoreGame(
      storedEvents.map((event) =>
        parseGameEventData({
          payload: event.payload,
          sequence: event.sequence,
          type: event.type,
          version: event.version,
        })
      )
    );

    if (state === null) {
      throw new Error(`Игра ${gameId} не содержит событий.`);
    }

    return state;
  }
}

function createStoredEvent(input: CreateStoredEventInput): FakeGameEvent {
  return {
    commandId: input.commandId,
    createdAt: input.createdAt,
    gameId: input.gameId,
    id: crypto.randomUUID(),
    payload: input.event.payload,
    sequence: input.event.sequence,
    type: input.event.type,
    version: input.event.version,
  };
}

function getPlayerViewer(playerId: string): Viewer {
  return { playerId, role: 'player' };
}

async function createRequestHash(value: unknown): Promise<string> {
  const encodedValue = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest('SHA-256', encodedValue);

  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}
