import {
  type ApiErrorCode,
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
  gameCommandMessageSchema,
  gameJoinMessageSchema,
  gameLeaveMessageSchema,
  gameSyncMessageSchema,
} from '@war-chest/api-contracts';
import { type Server, type Socket } from 'socket.io';
import type {
  ExecuteGameCommandResult,
  GameService,
  GameSynchronization,
  GameUpdate,
} from './GameService.js';

type GameSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type TrackSocketOperation = (operation: Promise<void>) => void;
const LOBBY_ROOM = 'lobby';

interface RegisterGameSocketInput {
  gameService: GameService;
  socket: GameSocket;
  trackSocketOperation: TrackSocketOperation;
}

export function registerGameSocket(input: RegisterGameSocketInput): void {
  const { gameService, socket, trackSocketOperation } = input;
  const joinedGameIds = new Set<string>();

  socket.on('game:command', receiveGameCommand);
  socket.on('game:join', joinGame);
  socket.on('game:leave', leaveGame);
  socket.on('game:sync', synchronizeGame);
  socket.on('lobby:subscribe', subscribeToLobby);
  socket.on('disconnect', disconnectFromGames);

  function subscribeToLobby(acknowledge: () => void): void {
    const operation = Promise.resolve(socket.join(LOBBY_ROOM)).then(
      acknowledge
    );

    trackSocketOperation(operation);
  }

  function receiveGameCommand(message: unknown): void {
    const result = gameCommandMessageSchema.safeParse(message);

    if (!result.success) {
      emitInvalidMessage('game:command');
      return;
    }

    runSocketOperation(result.data.gameId, async () => {
      const commandResult = await gameService.executeCommand({
        ...result.data,
        userId: socket.data.userId,
      });

      handleCommandResult(result.data.gameId, commandResult);
    });
  }

  function joinGame(message: unknown): void {
    const result = gameJoinMessageSchema.safeParse(message);

    if (!result.success) {
      emitInvalidMessage('game:join');
      return;
    }

    runSocketOperation(result.data.gameId, async () => {
      const connectionResult = await gameService.connect({
        connectionId: socket.id,
        gameId: result.data.gameId,
        userId: socket.data.userId,
      });

      if (connectionResult.status === 'gameNotFound') {
        emitGameError(
          'game_not_found',
          result.data.gameId,
          'Game was not found.'
        );
        return;
      }

      await socket.join(getGameRoom(result.data.gameId));
      joinedGameIds.add(result.data.gameId);
      socket.emit('game:snapshot', {
        gameId: result.data.gameId,
        view: connectionResult.view,
      });
    });
  }

  function leaveGame(message: unknown): void {
    const result = gameLeaveMessageSchema.safeParse(message);

    if (!result.success) {
      emitInvalidMessage('game:leave');
      return;
    }

    runSocketOperation(result.data.gameId, async () => {
      await gameService.disconnect({
        connectionId: socket.id,
        gameId: result.data.gameId,
        userId: socket.data.userId,
      });
      await socket.leave(getGameRoom(result.data.gameId));
      joinedGameIds.delete(result.data.gameId);
    });
  }

  function synchronizeGame(message: unknown): void {
    const result = gameSyncMessageSchema.safeParse(message);

    if (!result.success) {
      emitInvalidMessage('game:sync');
      return;
    }

    runSocketOperation(result.data.gameId, async () => {
      const synchronizationResult = await gameService.synchronize({
        ...result.data,
        userId: socket.data.userId,
      });

      if (synchronizationResult.status === 'gameNotFound') {
        emitGameError(
          'game_not_found',
          result.data.gameId,
          'Game was not found.'
        );
        return;
      }

      emitSynchronization(
        socket,
        result.data.gameId,
        synchronizationResult.synchronization
      );
    });
  }

  function disconnectFromGames(): void {
    const operation = Promise.all(
      [...joinedGameIds].map((gameId) =>
        gameService.disconnect({
          connectionId: socket.id,
          gameId,
          userId: socket.data.userId,
        })
      )
    )
      .then(() => undefined)
      .catch(() => undefined);

    joinedGameIds.clear();
    trackSocketOperation(operation);
  }

  function handleCommandResult(
    gameId: string,
    result: ExecuteGameCommandResult
  ): void {
    if (result.status === 'saved') {
      if (!joinedGameIds.has(gameId)) {
        socket.emit('game:events', { events: result.events, gameId });
      }

      return;
    }

    if (result.status === 'duplicateCommand') {
      emitSynchronization(socket, gameId, result.synchronization);
      return;
    }

    if (result.status === 'alreadyJoined') {
      socket.emit('game:snapshot', { gameId, view: result.view });
      return;
    }

    if (result.status === 'versionConflict') {
      socket.emit('game:error', {
        code: 'game_version_conflict',
        currentVersion: result.currentVersion,
        gameId,
        message: 'The game has changed since the requested version.',
      });
      return;
    }

    const errors = {
      commandIdConflict: {
        code: 'command_id_conflict',
        message: 'Command id was already used by another request.',
      },
      commandRejected: {
        code: 'game_command_rejected',
        message: 'The game command was rejected.',
      },
      gameCommandForbidden: {
        code: 'game_command_forbidden',
        message: 'The authenticated user cannot perform this game command.',
      },
      gameNotFound: {
        code: 'game_not_found',
        message: 'Game was not found.',
      },
      gamePositionOccupied: {
        code: 'game_position_occupied',
        message: 'The requested game position is occupied.',
      },
      playerAlreadyInGame: {
        code: 'player_already_in_game',
        message: 'The authenticated user is already playing another game.',
      },
    } as const;
    const error = errors[result.status];

    emitGameError(error.code, gameId, error.message);
  }

  function runSocketOperation(
    gameId: string,
    operation: () => Promise<void>
  ): void {
    const operationPromise = operation().catch(() => {
      emitGameError(
        'internal_error',
        gameId,
        'The game operation failed unexpectedly.'
      );
    });

    trackSocketOperation(operationPromise);
  }

  function emitInvalidMessage(eventName: string): void {
    emitGameError('invalid_message', null, `Invalid ${eventName} message.`);
  }

  function emitGameError(
    code: ApiErrorCode,
    gameId: string | null,
    message: string
  ): void {
    socket.emit('game:error', { code, gameId, message });
  }
}

export async function broadcastGameUpdate(
  socketServer: GameSocketServer,
  gameService: GameService,
  update: GameUpdate
): Promise<void> {
  socketServer.to(LOBBY_ROOM).emit('lobby:updated', {
    gameId: update.gameId,
  });
  const roomSockets = await socketServer
    .in(getGameRoom(update.gameId))
    .fetchSockets();

  await Promise.all(
    roomSockets.map(async (roomSocket) => {
      const result = await gameService.synchronize({
        afterSequence: update.previousVersion,
        gameId: update.gameId,
        userId: roomSocket.data.userId,
      });

      if (result.status === 'found') {
        emitSynchronization(roomSocket, update.gameId, result.synchronization);
      }
    })
  );
}

function emitSynchronization(
  socket: Pick<GameSocket, 'emit'>,
  gameId: string,
  synchronization: GameSynchronization
): void {
  if (synchronization.type === 'snapshot') {
    socket.emit('game:snapshot', { gameId, view: synchronization.view });
    return;
  }

  socket.emit('game:events', { events: synchronization.events, gameId });
}

function getGameRoom(gameId: string): string {
  return `game:${gameId}`;
}
