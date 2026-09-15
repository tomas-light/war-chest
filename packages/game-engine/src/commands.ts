import type { CardSelectionCommandData } from './command-data/CardSelectionCommandData.js';
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
  UpdateGameSettingsCommandData,
} from './command-data/LifecycleCommandData.js';
export type {
  TestMoveCommandData,
  TestScenarioCommandData,
} from './command-data/TestScenarioCommandData.js';

export type GameCommandData =
  CardSelectionCommandData | LifecycleCommandData | TestScenarioCommandData;
export type {
  CardSelectionCommandData,
  CompleteCardSelectionCommandData,
  ConfirmCardChoiceCommandData,
} from './command-data/CardSelectionCommandData.js';
