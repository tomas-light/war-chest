import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '@war-chest/api-contracts';
import type { Server, Socket } from 'socket.io';
import type { GameService } from '../GameService.js';

export type GameSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type GameSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type TrackSocketOperation = (operation: Promise<void>) => void;

export interface RegisterGameSocketInput {
  gameService: GameService;
  socket: GameSocket;
  trackSocketOperation: TrackSocketOperation;
}

export interface GameSocketContext extends RegisterGameSocketInput {
  joinedGameIds: Set<string>;
}
