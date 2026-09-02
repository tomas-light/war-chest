import type { EmptyWaitingGameExpiration } from './EmptyWaitingGameExpiration.js';
import type { GameLoader } from './GameLoader.js';
import type { CreateGameServiceOptions } from './GameServiceTypes.js';
import type { GameSynchronization } from './GameSynchronization.js';
import type { GameUpdatePublisher } from './GameUpdatePublisher.js';
import type { ReconnectDeadline } from './ReconnectDeadline.js';

export interface GameServiceContext {
  emptyWaitingGameExpiration: EmptyWaitingGameExpiration;
  gameLoader: GameLoader;
  gameSynchronization: GameSynchronization;
  gameUpdatePublisher: GameUpdatePublisher;
  options: CreateGameServiceOptions;
  reconnectDeadline: ReconnectDeadline;
}
