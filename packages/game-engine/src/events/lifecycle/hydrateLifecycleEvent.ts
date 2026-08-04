import type { GameEventData } from '../../events.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';
import { GameCreatedEvent } from './GameCreatedEvent.js';
import { GameFinishedEvent } from './GameFinishedEvent.js';
import { GameStartedEvent } from './GameStartedEvent.js';
import { PlayerJoinedEvent } from './PlayerJoinedEvent.js';

export function hydrateLifecycleEvent(
  data: GameEventData
): ApplicableEvent | null {
  switch (data.type) {
    case 'GameCreated':
      return GameCreatedEvent.fromData(data);
    case 'PlayerJoined':
      return PlayerJoinedEvent.fromData(data);
    case 'GameStarted':
      return GameStartedEvent.fromData(data);
    case 'GameFinished':
      return GameFinishedEvent.fromData(data);
    default:
      return null;
  }
}
