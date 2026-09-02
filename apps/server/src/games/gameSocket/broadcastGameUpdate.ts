import type { GameService, GameUpdate } from '../GameService.js';
import {
  emitSynchronization,
  getGameRoom,
  LOBBY_ROOM,
} from './gameSocketOperations.js';
import type { GameSocketServer } from './GameSocketTypes.js';

export async function broadcastGameUpdate(
  socketServer: GameSocketServer,
  gameService: GameService,
  update: GameUpdate
): Promise<void> {
  socketServer.to(LOBBY_ROOM).emit('lobby:updated', {
    gameId: update.gameId,
  });
  const roomSockets = await socketServer
    .in(getGameRoom(update.gameId))
    .fetchSockets();

  await Promise.all(
    roomSockets.map(async (roomSocket) => {
      const result = await gameService.synchronize({
        afterSequence: update.previousVersion,
        gameId: update.gameId,
        userId: roomSocket.data.userId,
      });

      if (result.status === 'found') {
        emitSynchronization(roomSocket, update.gameId, result.synchronization);
        return;
      }

      roomSocket.emit('game:error', {
        code: 'game_not_found',
        gameId: update.gameId,
        message: 'Game was not found.',
      });
    })
  );
}
