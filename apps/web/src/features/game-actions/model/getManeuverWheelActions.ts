import { type GameCoin, getUnitDefinition } from '@war-chest/game-engine';
import type { GameWheelAction } from './GameWheelAction';

export function getManeuverWheelActions(
  coin: GameCoin,
  canMove: boolean
): GameWheelAction[] {
  if (coin.kind === 'royal') {
    return [];
  }

  const definition = getUnitDefinition(coin.unitId);
  const actions: GameWheelAction[] = [
    { enabled: canMove, id: 'move' },
    { enabled: false, id: 'capture' },
    { enabled: false, id: 'reinforce' },
  ];

  // These maneuvers remain disabled until the engine can validate and perform them.
  if (definition.canAttack) {
    actions.push({ enabled: false, id: 'attack' });
  }

  if (definition.hasTactic) {
    actions.push({ enabled: false, id: 'tactic' });
  }

  return actions;
}
