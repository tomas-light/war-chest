import type { GameViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';
import { GameCreatedViewEvent } from './GameCreatedViewEvent.js';
import { GameFinishedViewEvent } from './GameFinishedViewEvent.js';
import { GameStartedViewEvent } from './GameStartedViewEvent.js';
import { PlayerDefeatedViewEvent } from './PlayerDefeatedViewEvent.js';
import { PlayerDisconnectedViewEvent } from './PlayerDisconnectedViewEvent.js';
import { PlayerJoinedViewEvent } from './PlayerJoinedViewEvent.js';
import { PlayerReconnectedViewEvent } from './PlayerReconnectedViewEvent.js';

export function hydrateLifecycleViewEvent(
  data: GameViewEventData
): ApplicableViewEvent | null {
  switch (data.type) {
    case 'GameCreated':
      return GameCreatedViewEvent.fromData(data);
    case 'PlayerJoined':
      return PlayerJoinedViewEvent.fromData(data);
    case 'PlayerDisconnected':
      return PlayerDisconnectedViewEvent.fromData(data);
    case 'PlayerReconnected':
      return PlayerReconnectedViewEvent.fromData(data);
    case 'PlayerDefeated':
      return PlayerDefeatedViewEvent.fromData(data);
    case 'GameStarted':
      return GameStartedViewEvent.fromData(data);
    case 'GameFinished':
      return GameFinishedViewEvent.fromData(data);
    default:
      return null;
  }
}
