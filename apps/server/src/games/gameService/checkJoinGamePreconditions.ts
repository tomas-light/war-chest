import { createViewFor } from '@war-chest/game-engine';
import type {
  CheckJoinGamePreconditionsInput,
  JoinGamePreconditionResult,
} from './GameServiceTypes.js';
import { getPlayerViewer } from './getPlayerViewer.js';

export function checkJoinGamePreconditions(
  input: CheckJoinGamePreconditionsInput
): JoinGamePreconditionResult | null {
  const isPositionOccupied = input.state.players.some(
    (player) =>
      player.id !== input.userId &&
      player.seat === input.command.seat &&
      player.team === input.command.team
  );

  if (isPositionOccupied) {
    return { status: 'gamePositionOccupied' };
  }

  if (input.participant === null) {
    return null;
  }

  const existingPlayer = input.state.players.find(
    (player) => player.id === input.userId
  );

  if (existingPlayer === undefined) {
    return { status: 'commandRejected' };
  }

  const hasRequestedPosition =
    existingPlayer.seat === input.command.seat &&
    existingPlayer.team === input.command.team;

  return hasRequestedPosition
    ? {
        status: 'alreadyJoined',
        view: createViewFor(input.state, getPlayerViewer(input.userId)),
      }
    : null;
}
