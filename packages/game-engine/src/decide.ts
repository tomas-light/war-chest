import { hydrateCommand } from './commands/hydrate-command.js';
import type { GameCommandData } from './commands.js';
import type { GameEventData } from './events.js';
import type { GameState } from './state.js';

export function decide(
  state: GameState,
  playerId: string,
  data: GameCommandData
): GameEventData[] {
  return hydrateCommand(data).decide(state, playerId);
}
