import type { GameCommandData } from '../../commands.js';
import type { DecidableCommand } from '../decidable-command.js';
import { TestMoveCommand } from './test-move-command.js';

export function hydrateTestScenarioCommand(
  data: GameCommandData
): DecidableCommand | null {
  switch (data.type) {
    case 'TestMove':
      return TestMoveCommand.fromData(data);
    default:
      return null;
  }
}
