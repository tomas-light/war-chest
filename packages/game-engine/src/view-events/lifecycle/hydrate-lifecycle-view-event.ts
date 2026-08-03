import type { GameViewEventData } from '../../view-events.js';
import type { ApplicableViewEvent } from '../applicable-view-event.js';
import { GameCreatedViewEvent } from './game-created-view-event.js';
import { GameFinishedViewEvent } from './game-finished-view-event.js';
import { GameStartedViewEvent } from './game-started-view-event.js';
import { PlayerJoinedViewEvent } from './player-joined-view-event.js';

export function hydrateLifecycleViewEvent(
  data: GameViewEventData
): ApplicableViewEvent | null {
  switch (data.type) {
    case 'GameCreated':
      return GameCreatedViewEvent.fromData(data);
    case 'PlayerJoined':
      return PlayerJoinedViewEvent.fromData(data);
    case 'GameStarted':
      return GameStartedViewEvent.fromData(data);
    case 'GameFinished':
      return GameFinishedViewEvent.fromData(data);
    default:
      return null;
  }
}
