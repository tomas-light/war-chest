import type { GameCommandData } from '../commands.js';
import {
  type CommandHydrator,
  type DecidableCommand,
} from './decidable-command.js';
import { hydrateLifecycleCommand } from './lifecycle/hydrate-lifecycle-command.js';
import { hydrateTestScenarioCommand } from './test-scenario/hydrate-test-scenario-command.js';

const COMMAND_HYDRATORS: readonly CommandHydrator[] = [
  hydrateLifecycleCommand,
  hydrateTestScenarioCommand,
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
