import type { CreateGameCommandData } from './commands.js';
import {
  type GameCreatedEventData,
  GAME_EVENT_VERSION,
  GAME_RULES_VERSION,
} from './events.js';

export function createGame(
  command: CreateGameCommandData
): GameCreatedEventData {
  return {
    payload: {
      featureFlags: { ...command.featureFlags },
      rulesVersion: GAME_RULES_VERSION,
    },
    sequence: 1,
    type: 'GameCreated',
    version: GAME_EVENT_VERSION,
  };
}
