import type { GameCommandData } from '../../commands.js';
import type { DecidableCommand } from '../DecidableCommand.js';
import { FinishGameCommand } from './FinishGameCommand.js';
import { JoinGameCommand } from './JoinGameCommand.js';
import { LeaveGameCommand } from './LeaveGameCommand.js';
import { StartGameCommand } from './StartGameCommand.js';
import { SurrenderGameCommand } from './SurrenderGameCommand.js';
import { SwapPlayerPositionsCommand } from './SwapPlayerPositionsCommand.js';

export function hydrateLifecycleCommand(
  data: GameCommandData
): DecidableCommand | null {
  switch (data.type) {
    case 'JoinGame':
      return JoinGameCommand.fromData(data);
    case 'LeaveGame':
      return LeaveGameCommand.fromData(data);
    case 'StartGame':
      return StartGameCommand.fromData(data);
    case 'SwapPlayerPositions':
      return SwapPlayerPositionsCommand.fromData(data);
    case 'FinishGame':
      return FinishGameCommand.fromData(data);
    case 'SurrenderGame':
      return SurrenderGameCommand.fromData(data);
    default:
      return null;
  }
}
