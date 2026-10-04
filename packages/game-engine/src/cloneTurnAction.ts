import type { TurnAction } from './command-data/TurnCommandData.js';

export function cloneTurnAction(action: TurnAction): TurnAction {
  if (action.type === 'tactic') {
    return {
      ...action,
      maneuvers: action.maneuvers.map((maneuver) => ({ ...maneuver })),
    };
  }

  return { ...action };
}
