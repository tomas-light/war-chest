import type { GameCommandData } from '../../commands.js';
import type { DecidableCommand } from '../DecidableCommand.js';
import { PassTurnCommand } from './PassTurnCommand.js';
import { PerformTurnActionCommand } from './PerformTurnActionCommand.js';

export function hydrateTurnCommand(
  data: GameCommandData
): DecidableCommand | null {
  if (data.type === 'PassTurn') {
    return PassTurnCommand.fromData(data);
  }

  if (data.type === 'PerformTurnAction') {
    return PerformTurnActionCommand.fromData(data);
  }

  return null;
}
