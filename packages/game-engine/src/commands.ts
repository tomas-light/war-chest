import type { LifecycleCommandData } from './command-data/LifecycleCommandData.js';
import type { TestScenarioCommandData } from './command-data/TestScenarioCommandData.js';

export type {
  CreateGameCommandData,
  FinishGameCommandData,
  JoinGameCommandData,
  LeaveGameCommandData,
  LifecycleCommandData,
  StartGameCommandData,
  SurrenderGameCommandData,
  SwapPlayerPositionsCommandData,
} from './command-data/LifecycleCommandData.js';
export type {
  TestMoveCommandData,
  TestScenarioCommandData,
} from './command-data/TestScenarioCommandData.js';

export type GameCommandData = LifecycleCommandData | TestScenarioCommandData;
