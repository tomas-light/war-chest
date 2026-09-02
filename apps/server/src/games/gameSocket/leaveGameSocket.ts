import { gameLeaveMessageSchema } from '@war-chest/api-contracts';
import {
  emitInvalidMessage,
  getGameRoom,
  runSocketOperation,
} from './gameSocketOperations.js';
import type { GameSocketContext } from './GameSocketTypes.js';

export function leaveGameSocket(
  context: GameSocketContext,
  message: unknown
): void {
  const result = gameLeaveMessageSchema.safeParse(message);

  if (!result.success) {
    emitInvalidMessage(context.socket, 'game:leave');
    return;
  }

  runSocketOperation(context, result.data.gameId, async () => {
    await context.gameService.disconnect({
      connectionId: context.socket.id,
      gameId: result.data.gameId,
      userId: context.socket.data.userId,
    });
    await context.socket.leave(getGameRoom(result.data.gameId));
    context.joinedGameIds.delete(result.data.gameId);
  });
}
