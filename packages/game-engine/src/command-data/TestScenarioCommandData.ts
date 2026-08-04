import type { JsonValue } from '../state.js';

export interface TestMoveCommandData {
  privateData?: JsonValue;
  type: 'TestMove';
}

export type TestScenarioCommandData = TestMoveCommandData;
