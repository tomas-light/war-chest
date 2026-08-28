import {
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
  SOCKET_IO_PATH,
} from '@war-chest/api-contracts';
import type { Auth } from '@war-chest/auth';
import type { FastifyInstance } from 'fastify';
import { type ExtendedError, type Socket, Server } from 'socket.io';
import type { GameService } from '../games/GameService.js';
import {
  broadcastGameUpdate,
  registerGameSocket,
} from '../games/registerGameSocket.js';

type GameSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function createSocketServer(
  app: FastifyInstance,
  auth: Auth,
  gameService: GameService
): GameSocketServer {
  const pendingSocketOperations = new Set<Promise<void>>();
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
  socketServer.on('connection', (socket) => {
    registerGameSocket({
      gameService,
      socket,
      trackSocketOperation,
    });
  });
  const unsubscribeFromGameUpdates = gameService.subscribe((update) =>
    broadcastGameUpdate(socketServer, gameService, update)
  );
  app.addHook('preClose', closeSocketServer);

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

  async function closeSocketServer(): Promise<void> {
    unsubscribeFromGameUpdates();
    await new Promise<void>((resolve) => {
      void socketServer.close(() => {
        resolve();
      });
    });
    await Promise.all(pendingSocketOperations);
  }

  function trackSocketOperation(operation: Promise<void>): void {
    pendingSocketOperations.add(operation);
    void operation
      .finally(() => {
        pendingSocketOperations.delete(operation);
      })
      .catch(() => undefined);
  }
}
