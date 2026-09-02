import { gameJoinMessageSchema } from '@war-chest/api-contracts';
import {
  emitGameError,
  emitInvalidMessage,
  getGameRoom,
  runSocketOperation,
} from './gameSocketOperations.js';
import type { GameSocketContext } from './GameSocketTypes.js';

export function joinGameSocket(
  context: GameSocketContext,
  message: unknown
): void {
  const result = gameJoinMessageSchema.safeParse(message);

  if (!result.success) {
    emitInvalidMessage(context.socket, 'game:join');
    return;
  }

  runSocketOperation(context, result.data.gameId, async () => {
    const connectionResult = await context.gameService.connect({
      connectionId: context.socket.id,
      gameId: result.data.gameId,
      userId: context.socket.data.userId,
    });

    if (connectionResult.status === 'gameNotFound') {
      emitGameError({
        code: 'game_not_found',
        gameId: result.data.gameId,
        message: 'Game was not found.',
        socket: context.socket,
      });
      return;
    }

    await context.socket.join(getGameRoom(result.data.gameId));
    context.joinedGameIds.add(result.data.gameId);
    context.socket.emit('game:snapshot', {
      gameId: result.data.gameId,
      view: connectionResult.view,
    });
  });
}
