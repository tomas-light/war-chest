import type { GameEventData } from '../../events.js';
import type { ApplicableEvent } from '../applicable-event.js';
import { GameCreatedEvent } from './game-created-event.js';
import { GameFinishedEvent } from './game-finished-event.js';
import { GameStartedEvent } from './game-started-event.js';
import { PlayerJoinedEvent } from './player-joined-event.js';

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
