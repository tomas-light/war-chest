import { connect as connectToGame } from './gameService/connect.js';
import { createGame as createNewGame } from './gameService/createGame.js';
import { disconnect as disconnectFromGame } from './gameService/disconnect.js';
import { createEmptyWaitingGameExpiration } from './gameService/EmptyWaitingGameExpiration.js';
import { executeCommand as executeGameCommand } from './gameService/executeCommand.js';
import { createGameLoader } from './gameService/GameLoader.js';
import type { GameServiceContext } from './gameService/GameServiceContext.js';
import type {
  ConnectToGameResult,
  CreateGameInput,
  CreateGameResult,
  CreateGameServiceOptions,
  DisconnectFromGameResult,
  ExecuteGameCommandInput,
  ExecuteGameCommandResult,
  GameConnectionInput,
  GameService,
  GameUpdateListener,
  GetGameEventsInput,
  GetGameEventsResult,
  GetGameSnapshotInput,
  GetGameSnapshotResult,
  ListLobbyGamesInput,
  ReconnectDeadlineInput,
  SynchronizeGameInput,
  SynchronizeGameResult,
} from './gameService/GameServiceTypes.js';
import { createGameSynchronization } from './gameService/GameSynchronization.js';
import { createGameUpdatePublisher } from './gameService/GameUpdatePublisher.js';
import { getEvents as getGameEvents } from './gameService/getEvents.js';
import { getSnapshot as getGameSnapshot } from './gameService/getSnapshot.js';
import { listLobbyGames as listAvailableLobbyGames } from './gameService/listLobbyGames.js';
import { processReconnectDeadline } from './gameService/processReconnectDeadline.js';
import { createReconnectDeadline } from './gameService/ReconnectDeadline.js';
import { recoverGames as recoverStoredGames } from './gameService/recoverGames.js';
import { synchronize as synchronizeGame } from './gameService/synchronize.js';

export type {
  ExecuteGameCommandResult,
  GameService,
  GameSynchronization,
  GameUpdate,
} from './gameService/GameServiceTypes.js';

export function createGameService(
  options: CreateGameServiceOptions
): GameService {
  const gameUpdatePublisher = createGameUpdatePublisher();
  const emptyWaitingGameExpiration = createEmptyWaitingGameExpiration({
    activeGames: options.activeGames,
    emptyWaitingGameTimeoutMs: options.emptyWaitingGameTimeoutMs,
    gameRepository: options.gameRepository,
    gameUpdatePublisher,
  });
  const reconnectDeadline = createReconnectDeadline({ processDeadline });
  const gameLoader = createGameLoader({
    activeGames: options.activeGames,
    emptyWaitingGameExpiration,
    gameRepository: options.gameRepository,
    reconnectDeadline,
  });
  const gameSynchronization = createGameSynchronization(options.gameRepository);

  const context: GameServiceContext = {
    emptyWaitingGameExpiration,
    gameLoader,
    gameSynchronization,
    gameUpdatePublisher,
    options,
    reconnectDeadline,
  };

  return {
    close,
    connect,
    createGame,
    disconnect,
    executeCommand,
    getEvents,
    getSnapshot,
    listLobbyGames,
    recoverGames,
    subscribe,
    synchronize,
  };

  function close(): void {
    reconnectDeadline.close();
    emptyWaitingGameExpiration.close();
    gameUpdatePublisher.close();
  }

  function connect(input: GameConnectionInput): Promise<ConnectToGameResult> {
    return connectToGame(context, input);
  }

  function createGame(input: CreateGameInput): Promise<CreateGameResult> {
    return createNewGame(context, input);
  }

  function disconnect(
    input: GameConnectionInput
  ): Promise<DisconnectFromGameResult> {
    return disconnectFromGame(context, input);
  }

  function executeCommand(
    input: ExecuteGameCommandInput
  ): Promise<ExecuteGameCommandResult> {
    return executeGameCommand(context, input);
  }

  function getEvents(input: GetGameEventsInput): Promise<GetGameEventsResult> {
    return getGameEvents(context, input);
  }

  function getSnapshot(
    input: GetGameSnapshotInput
  ): Promise<GetGameSnapshotResult> {
    return getGameSnapshot(context, input);
  }

  function listLobbyGames(input: ListLobbyGamesInput) {
    return listAvailableLobbyGames(context, input);
  }

  function recoverGames(): Promise<void> {
    return recoverStoredGames(context);
  }

  function subscribe(listener: GameUpdateListener): () => void {
    return gameUpdatePublisher.subscribe(listener);
  }

  function synchronize(
    input: SynchronizeGameInput
  ): Promise<SynchronizeGameResult> {
    return synchronizeGame(context, input);
  }

  function processDeadline(input: ReconnectDeadlineInput): Promise<void> {
    return processReconnectDeadline(context, input);
  }
}
