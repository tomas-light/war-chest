import type { GameCommandData } from '../../commands.js';
import type { DecidableCommand } from '../DecidableCommand.js';
import { TestMoveCommand } from './TestMoveCommand.js';

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
