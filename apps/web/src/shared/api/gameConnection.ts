import {
  type ClientToServerEvents,
  type GameErrorMessage,
  type GameEventsMessage,
  type GameSnapshotMessage,
  type ServerToClientEvents,
  gameErrorMessageSchema,
  gameEventsMessageSchema,
  gameSnapshotMessageSchema,
  SOCKET_IO_PATH,
} from '@war-chest/api-contracts';
import { type Socket, io } from 'socket.io-client';
import { readDevBackend } from '../config/backendKind';

export interface GameConnectionHandlers {
  onError(message: GameErrorMessage): void;
  onEvents(message: GameEventsMessage): void;
  onSnapshot(message: GameSnapshotMessage): void;
}

export interface GameConnection {
  connect(): void;
  disconnect(): void;
  join(gameId: string): void;
  leave(gameId: string): void;
  synchronize(gameId: string, afterSequence: number): void;
}

export function createGameConnection(
  handlers: GameConnectionHandlers
): GameConnection {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
    autoConnect: false,
    path: SOCKET_IO_PATH,
  });

  socket.on('game:error', (message) => {
    handlers.onError(gameErrorMessageSchema.parse(message));
  });
  socket.on('game:events', (message) => {
    handlers.onEvents(gameEventsMessageSchema.parse(message));
  });
  socket.on('game:snapshot', (message) => {
    handlers.onSnapshot(gameSnapshotMessageSchema.parse(message));
  });

  return {
    connect,
    disconnect,
    join,
    leave,
    synchronize,
  };

  function connect(): void {
    socket.connect();
  }

  function disconnect(): void {
    socket.disconnect();
  }

  function join(gameId: string): void {
    socket.emit('game:join', { gameId });
  }

  function leave(gameId: string): void {
    socket.emit('game:leave', { gameId });
  }

  function synchronize(gameId: string, afterSequence: number): void {
    socket.emit('game:sync', { afterSequence, gameId });
  }
}

export async function createSelectedGameConnection(
  handlers: GameConnectionHandlers
): Promise<GameConnection> {
  if (import.meta.env.DEV && readDevBackend() === 'fake') {
    const { createFakeGameConnection } =
      await import('./createFakeGameConnection');

    return createFakeGameConnection(handlers);
  }

  return createGameConnection(handlers);
}
