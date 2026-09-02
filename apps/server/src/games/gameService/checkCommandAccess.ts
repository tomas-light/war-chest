import type {
  CheckCommandAccessInput,
  CommandAccessResult,
} from './GameServiceTypes.js';

export function checkCommandAccess(
  input: CheckCommandAccessInput
): CommandAccessResult | null {
  if (input.command.type === 'JoinGame') {
    return null;
  }

  if (
    input.command.type === 'StartGame' ||
    input.command.type === 'SwapPlayerPositions'
  ) {
    return input.state.creatorId === input.userId
      ? null
      : { status: 'gameCommandForbidden' };
  }

  if (
    input.command.type === 'LeaveGame' &&
    input.state.creatorId === input.userId
  ) {
    return null;
  }

  return input.participant === null ? { status: 'gameCommandForbidden' } : null;
}
