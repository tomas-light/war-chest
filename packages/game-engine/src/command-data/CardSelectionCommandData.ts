import type { UnitId } from '../UnitId.js';

export interface ConfirmCardChoiceCommandData {
  unitId: UnitId;
  type: 'ConfirmCardChoice';
}

export interface CompleteCardSelectionCommandData {
  type: 'CompleteCardSelection';
}

export type CardSelectionCommandData =
  CompleteCardSelectionCommandData | ConfirmCardChoiceCommandData;
