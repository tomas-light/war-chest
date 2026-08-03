import type { GameCommandData } from '../../commands.js';
import type { DecidableCommand } from '../decidable-command.js';
import { FinishGameCommand } from './finish-game-command.js';
import { JoinGameCommand } from './join-game-command.js';
import { StartGameCommand } from './start-game-command.js';

export function hydrateLifecycleCommand(
  data: GameCommandData
): DecidableCommand | null {
  switch (data.type) {
    case 'JoinGame':
      return JoinGameCommand.fromData(data);
    case 'StartGame':
      return StartGameCommand.fromData(data);
    case 'FinishGame':
      return FinishGameCommand.fromData(data);
    default:
      return null;
  }
}
