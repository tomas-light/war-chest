import { LOBBY_ROOM } from './gameSocketOperations.js';
import type { GameSocketContext } from './GameSocketTypes.js';

export function subscribeToLobby(
  context: GameSocketContext,
  acknowledge: () => void
): void {
  const operation = Promise.resolve(context.socket.join(LOBBY_ROOM)).then(
    acknowledge
  );

  context.trackSocketOperation(operation);
}
