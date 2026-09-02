import type { GameSocketContext } from './GameSocketTypes.js';

export function disconnectFromGames(context: GameSocketContext): void {
  const operation = Promise.all(
    [...context.joinedGameIds].map((gameId) =>
      context.gameService.disconnect({
        connectionId: context.socket.id,
        gameId,
        userId: context.socket.data.userId,
      })
    )
  )
    .then(() => undefined)
    .catch(() => undefined);

  context.joinedGameIds.clear();
  context.trackSocketOperation(operation);
}
