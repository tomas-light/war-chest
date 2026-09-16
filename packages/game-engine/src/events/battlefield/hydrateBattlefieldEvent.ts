import type { GameEventData } from '../../events.js';
import type { ApplicableEvent } from '../ApplicableEvent.js';
import { BattlefieldPreparedEvent } from './BattlefieldPreparedEvent.js';

export function hydrateBattlefieldEvent(
  data: GameEventData
): ApplicableEvent | null {
  if (data.type === 'BattlefieldPrepared') {
    return BattlefieldPreparedEvent.fromData(data);
  }

  return null;
}
