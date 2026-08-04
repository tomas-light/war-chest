import {
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
  gameCommandMessageSchema,
  gameJoinMessageSchema,
  gameLeaveMessageSchema,
  gameSyncMessageSchema,
  SOCKET_IO_PATH,
} from '@war-chest/api-contracts';
import type { Auth } from '@war-chest/auth';
import type { FastifyInstance } from 'fastify';
import { type ExtendedError, type Socket, Server } from 'socket.io';

type GameSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function createSocketServer(
  app: FastifyInstance,
  auth: Auth
): GameSocketServer {
  const socketServer = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(app.server, {
    path: SOCKET_IO_PATH,
    serveClient: false,
  });

  socketServer.use((socket, continueConnection) => {
    void authenticateSocket(socket, continueConnection);
  });
  socketServer.on('connection', registerGameSocket);
  app.addHook('onClose', closeSocketServer);

  return socketServer;

  async function authenticateSocket(
    socket: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >,
    continueConnection: (error?: ExtendedError) => void
  ): Promise<void> {
    try {
      const cookies = app.parseCookie(socket.handshake.headers.cookie ?? '');
      const sessionToken = cookies[auth.sessionCookieName];

      if (sessionToken === undefined) {
        continueConnection(new Error('Authentication is required.'));
        return;
      }

      const session = await auth.getSession(sessionToken);

      if (session === null) {
        continueConnection(new Error('Authentication is required.'));
        return;
      }

      socket.data.userId = session.user.id;
      continueConnection();
    } catch (error) {
      continueConnection(
        error instanceof Error ? error : new Error('Authentication failed.')
      );
    }
  }

  function registerGameSocket(
    socket: Socket<
      ClientToServerEvents,
      ServerToClientEvents,
      InterServerEvents,
      SocketData
    >
  ): void {
    socket.on('game:command', receiveGameCommand);
    socket.on('game:join', joinGame);
    socket.on('game:leave', leaveGame);
    socket.on('game:sync', synchronizeGame);

    function receiveGameCommand(message: unknown): void {
      if (!gameCommandMessageSchema.safeParse(message).success) {
        emitInvalidMessage('game:command');
      }
    }

    function joinGame(message: unknown): void {
      const result = gameJoinMessageSchema.safeParse(message);

      if (!result.success) {
        emitInvalidMessage('game:join');
        return;
      }

      void socket.join(getGameRoom(result.data.gameId));
    }

    function leaveGame(message: unknown): void {
      const result = gameLeaveMessageSchema.safeParse(message);

      if (!result.success) {
        emitInvalidMessage('game:leave');
        return;
      }

      void socket.leave(getGameRoom(result.data.gameId));
    }

    function synchronizeGame(message: unknown): void {
      if (!gameSyncMessageSchema.safeParse(message).success) {
        emitInvalidMessage('game:sync');
      }
    }

    function emitInvalidMessage(eventName: string): void {
      socket.emit('game:error', {
        code: 'invalid_message',
        gameId: null,
        message: `Invalid ${eventName} message.`,
      });
    }
  }

  async function closeSocketServer(): Promise<void> {
    await new Promise<void>((resolve) => {
      void socketServer.close(() => {
        resolve();
      });
    });
  }
}

function getGameRoom(gameId: string): string {
  return `game:${gameId}`;
}
