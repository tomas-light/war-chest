import type { CardSelectionCommandData } from './command-data/CardSelectionCommandData.js';
import type { LifecycleCommandData } from './command-data/LifecycleCommandData.js';
import type { TestScenarioCommandData } from './command-data/TestScenarioCommandData.js';
import type { TurnCommandData } from './command-data/TurnCommandData.js';

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
  | CardSelectionCommandData
  | LifecycleCommandData
  | TestScenarioCommandData
  | TurnCommandData;
export type {
  CardSelectionCommandData,
  CompleteCardSelectionCommandData,
  ConfirmCardChoiceCommandData,
} from './command-data/CardSelectionCommandData.js';
export type {
  PassTurnCommandData,
  PerformTurnActionCommandData,
  TurnAction,
  TurnCommandData,
} from './command-data/TurnCommandData.js';
