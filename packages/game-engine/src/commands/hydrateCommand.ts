import type { GameCommandData } from '../commands.js';
import { hydrateCardSelectionCommand } from './card-selection/hydrateCardSelectionCommand.js';
import {
  type CommandHydrator,
  type DecidableCommand,
} from './DecidableCommand.js';
import { hydrateLifecycleCommand } from './lifecycle/hydrateLifecycleCommand.js';
import { hydrateTestScenarioCommand } from './test-scenario/hydrateTestScenarioCommand.js';
import { hydrateTurnCommand } from './turn/hydrateTurnCommand.js';

const COMMAND_HYDRATORS: readonly CommandHydrator[] = [
  hydrateCardSelectionCommand,
  hydrateLifecycleCommand,
  hydrateTestScenarioCommand,
  hydrateTurnCommand,
];

export function hydrateCommand(data: GameCommandData): DecidableCommand {
  for (const hydrateCommandGroup of COMMAND_HYDRATORS) {
    const command = hydrateCommandGroup(data);

    if (command !== null) {
      return command;
    }
  }

  throw new Error(`Unsupported game command type: ${data.type}`);
}
