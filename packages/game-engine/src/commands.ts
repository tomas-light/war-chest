import type { LifecycleCommandData } from './command-data/lifecycle-command-data.js';
import type { TestScenarioCommandData } from './command-data/test-scenario-command-data.js';

export type {
  CreateGameCommandData,
  FinishGameCommandData,
  JoinGameCommandData,
  LifecycleCommandData,
  StartGameCommandData,
} from './command-data/lifecycle-command-data.js';
export type {
  TestMoveCommandData,
  TestScenarioCommandData,
} from './command-data/test-scenario-command-data.js';

export type GameCommandData = LifecycleCommandData | TestScenarioCommandData;
