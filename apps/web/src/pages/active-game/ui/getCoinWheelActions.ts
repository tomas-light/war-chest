import type { GameCoin, TurnActionOptions } from '@war-chest/game-engine';
import type { GameWheelAction } from '#/features/game-actions';

const UNIT_ACTION_IDS: readonly GameWheelAction['id'][] = [
  'deploy',
  'reinforce',
  'maneuver',
  'pass',
  'initiative',
  'recruit',
];
const ROYAL_ACTION_IDS: readonly GameWheelAction['id'][] = [
  'initiative',
  'recruit',
  'pass',
];

export function getCoinWheelActions(
  coin: GameCoin,
  canPass: boolean,
  options: TurnActionOptions
): GameWheelAction[] {
  const actionIds = coin.kind === 'royal' ? ROYAL_ACTION_IDS : UNIT_ACTION_IDS;

  return actionIds.map((id) => ({
    enabled:
      (id === 'pass' && canPass) ||
      (id === 'deploy' && options.deployCells.length > 0) ||
      (id === 'recruit' && options.recruitUnits.length > 0),
    id,
  }));
}
