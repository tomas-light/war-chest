import { gameSyncMessageSchema } from '@war-chest/api-contracts';
import {
  emitGameError,
  emitInvalidMessage,
  emitSynchronization,
  runSocketOperation,
} from './gameSocketOperations.js';
import type { GameSocketContext } from './GameSocketTypes.js';

export function synchronizeGameSocket(
  context: GameSocketContext,
  message: unknown
): void {
  const result = gameSyncMessageSchema.safeParse(message);

  if (!result.success) {
    emitInvalidMessage(context.socket, 'game:sync');
    return;
  }

  runSocketOperation(context, result.data.gameId, async () => {
    const synchronizationResult = await context.gameService.synchronize({
      ...result.data,
      userId: context.socket.data.userId,
    });

    if (synchronizationResult.status === 'gameNotFound') {
      emitGameError({
        code: 'game_not_found',
        gameId: result.data.gameId,
        message: 'Game was not found.',
        socket: context.socket,
      });
      return;
    }

    emitSynchronization(
      context.socket,
      result.data.gameId,
      synchronizationResult.synchronization
    );
  });
}
