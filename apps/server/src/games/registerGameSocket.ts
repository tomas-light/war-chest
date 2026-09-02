import { disconnectFromGames } from './gameSocket/disconnectFromGames.js';
import type {
  GameSocketContext,
  RegisterGameSocketInput,
} from './gameSocket/GameSocketTypes.js';
import { joinGameSocket } from './gameSocket/joinGameSocket.js';
import { leaveGameSocket } from './gameSocket/leaveGameSocket.js';
import { receiveGameCommand } from './gameSocket/receiveGameCommand.js';
import { subscribeToLobby } from './gameSocket/subscribeToLobby.js';
import { synchronizeGameSocket } from './gameSocket/synchronizeGameSocket.js';

export { broadcastGameUpdate } from './gameSocket/broadcastGameUpdate.js';

export function registerGameSocket(input: RegisterGameSocketInput): void {
  const context: GameSocketContext = {
    ...input,
    joinedGameIds: new Set<string>(),
  };

  input.socket.on('game:command', (message) => {
    receiveGameCommand(context, message);
  });
  input.socket.on('game:join', (message) => {
    joinGameSocket(context, message);
  });
  input.socket.on('game:leave', (message) => {
    leaveGameSocket(context, message);
  });
  input.socket.on('game:sync', (message) => {
    synchronizeGameSocket(context, message);
  });
  input.socket.on('lobby:subscribe', (acknowledge) => {
    subscribeToLobby(context, acknowledge);
  });
  input.socket.on('disconnect', () => {
    disconnectFromGames(context);
  });
}
