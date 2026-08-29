import type { GameEventData } from '../../events.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';
import { GameCreatedEvent } from './GameCreatedEvent.js';
import { GameFinishedEvent } from './GameFinishedEvent.js';
import { GameStartedEvent } from './GameStartedEvent.js';
import { PlayerDefeatedEvent } from './PlayerDefeatedEvent.js';
import { PlayerDisconnectedEvent } from './PlayerDisconnectedEvent.js';
import { PlayerJoinedEvent } from './PlayerJoinedEvent.js';
import { PlayerLeftEvent } from './PlayerLeftEvent.js';
import { PlayerPositionChangedEvent } from './PlayerPositionChangedEvent.js';
import { PlayerPositionsSwappedEvent } from './PlayerPositionsSwappedEvent.js';
import { PlayerReconnectedEvent } from './PlayerReconnectedEvent.js';

export function hydrateLifecycleEvent(
  data: GameEventData
): ApplicableEvent | null {
  switch (data.type) {
    case 'GameCreated':
      return GameCreatedEvent.fromData(data);
    case 'PlayerJoined':
      return PlayerJoinedEvent.fromData(data);
    case 'PlayerLeft':
      return PlayerLeftEvent.fromData(data);
    case 'PlayerPositionChanged':
      return PlayerPositionChangedEvent.fromData(data);
    case 'PlayerPositionsSwapped':
      return PlayerPositionsSwappedEvent.fromData(data);
    case 'PlayerDisconnected':
      return PlayerDisconnectedEvent.fromData(data);
    case 'PlayerReconnected':
      return PlayerReconnectedEvent.fromData(data);
    case 'PlayerDefeated':
      return PlayerDefeatedEvent.fromData(data);
    case 'GameStarted':
      return GameStartedEvent.fromData(data);
    case 'GameFinished':
      return GameFinishedEvent.fromData(data);
    default:
      return null;
  }
}
