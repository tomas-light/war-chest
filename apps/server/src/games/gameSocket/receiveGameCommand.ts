import { gameCommandMessageSchema } from '@war-chest/api-contracts';
import {
  emitInvalidMessage,
  runSocketOperation,
} from './gameSocketOperations.js';
import type { GameSocketContext } from './GameSocketTypes.js';
import { handleCommandResult } from './handleCommandResult.js';

export function receiveGameCommand(
  context: GameSocketContext,
  message: unknown
): void {
  const result = gameCommandMessageSchema.safeParse(message);

  if (!result.success) {
    emitInvalidMessage(context.socket, 'game:command');
    return;
  }

  runSocketOperation(context, result.data.gameId, async () => {
    const commandResult = await context.gameService.executeCommand({
      ...result.data,
      userId: context.socket.data.userId,
    });

    handleCommandResult(context, result.data.gameId, commandResult);
  });
}
