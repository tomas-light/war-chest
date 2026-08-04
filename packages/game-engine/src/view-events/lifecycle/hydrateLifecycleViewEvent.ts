import type { GameViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';
import { GameCreatedViewEvent } from './GameCreatedViewEvent.js';
import { GameFinishedViewEvent } from './GameFinishedViewEvent.js';
import { GameStartedViewEvent } from './GameStartedViewEvent.js';
import { PlayerJoinedViewEvent } from './PlayerJoinedViewEvent.js';

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
