import type { GameViewEventData } from '../../viewEvents.js';
import type { ApplicableViewEvent } from '../ApplicableViewEvent.js';
import { BattlefieldPreparedViewEvent } from './BattlefieldPreparedViewEvent.js';

export function hydrateBattlefieldViewEvent(
  data: GameViewEventData
): ApplicableViewEvent | null {
  if (data.type === 'BattlefieldPrepared') {
    return BattlefieldPreparedViewEvent.fromData(data);
  }

  return null;
}
