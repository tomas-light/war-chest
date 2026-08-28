import {
  type ClientToServerEvents,
  type LobbyUpdatedMessage,
  type ServerToClientEvents,
  lobbyUpdatedMessageSchema,
  SOCKET_IO_PATH,
} from '@war-chest/api-contracts';
import { type Socket, io } from 'socket.io-client';

export interface LobbyConnectionHandlers {
  onSubscribed(this: void): void;
  onUpdated(this: void, message: LobbyUpdatedMessage): void;
}

export interface LobbyConnection {
  connect(this: void): void;
  disconnect(this: void): void;
}

export function createLobbyConnection(
  handlers: LobbyConnectionHandlers
): LobbyConnection {
  const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
    autoConnect: false,
    path: SOCKET_IO_PATH,
  });

  socket.on('connect', subscribe);
  socket.on('lobby:updated', (message) => {
    handlers.onUpdated(lobbyUpdatedMessageSchema.parse(message));
  });

  return { connect, disconnect };

  function connect(): void {
    socket.connect();
  }

  function disconnect(): void {
    socket.disconnect();
  }

  function subscribe(): void {
    socket.emit('lobby:subscribe', handlers.onSubscribed);
  }
}

export async function createSelectedLobbyConnection(
  handlers: LobbyConnectionHandlers
): Promise<LobbyConnection> {
  if (import.meta.env.DEV) {
    const { readDevBackend } = await import('../config/backendKind');

    if (readDevBackend() === 'fake') {
      const { createFakeLobbyConnection } =
        await import('./createFakeLobbyConnection');

      return createFakeLobbyConnection(handlers);
    }
  }

  return createLobbyConnection(handlers);
}
