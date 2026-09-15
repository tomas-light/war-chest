import type { GameCommandData } from '../../commands.js';
import type { DecidableCommand } from '../DecidableCommand.js';
import { CompleteCardSelectionCommand } from './CompleteCardSelectionCommand.js';
import { ConfirmCardChoiceCommand } from './ConfirmCardChoiceCommand.js';

export function hydrateCardSelectionCommand(
  data: GameCommandData
): DecidableCommand | null {
  if (data.type === 'CompleteCardSelection') {
    return CompleteCardSelectionCommand.fromData(data);
  }

  return data.type === 'ConfirmCardChoice'
    ? ConfirmCardChoiceCommand.fromData(data)
    : null;
}
