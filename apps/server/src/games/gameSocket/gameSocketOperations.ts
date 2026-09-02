import type { ApiErrorCode } from '@war-chest/api-contracts';
import type { GameSynchronization } from '../GameService.js';
import type { GameSocket, GameSocketContext } from './GameSocketTypes.js';

interface EmitGameErrorInput {
  code: ApiErrorCode;
  gameId: string | null;
  message: string;
  socket: GameSocket;
}

export const LOBBY_ROOM = 'lobby';

export function runSocketOperation(
  context: GameSocketContext,
  gameId: string,
  operation: () => Promise<void>
): void {
  const operationPromise = operation().catch(() => {
    emitGameError({
      code: 'internal_error',
      gameId,
      message: 'The game operation failed unexpectedly.',
      socket: context.socket,
    });
  });

  context.trackSocketOperation(operationPromise);
}

export function emitInvalidMessage(
  socket: GameSocket,
  eventName: string
): void {
  emitGameError({
    code: 'invalid_message',
    gameId: null,
    message: `Invalid ${eventName} message.`,
    socket,
  });
}

export function emitGameError(input: EmitGameErrorInput): void {
  input.socket.emit('game:error', {
    code: input.code,
    gameId: input.gameId,
    message: input.message,
  });
}

export function emitSynchronization(
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

export function getGameRoom(gameId: string): string {
  return `game:${gameId}`;
}
