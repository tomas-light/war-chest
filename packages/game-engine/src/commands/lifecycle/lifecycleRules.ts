import type { GameFormat } from '../../GameSettings.js';
import type { GameTeam } from '../../state.js';

interface GamePosition {
  seat: number;
  team: GameTeam;
}

const DUEL_POSITIONS: readonly GamePosition[] = [
  { seat: 1, team: 'white' },
  { seat: 1, team: 'black' },
];
const TEAM_POSITIONS: readonly GamePosition[] = [
  { seat: 1, team: 'white' },
  { seat: 2, team: 'white' },
  { seat: 1, team: 'black' },
  { seat: 2, team: 'black' },
];

export const FIRST_PLAYER_SEAT = 1;
export const FIRST_PLAYER_TEAM: GameTeam = 'white';
export function getRequiredPlayerCount(format: GameFormat): number {
  return getGamePositions(format).length;
}

export function isGamePosition(
  format: GameFormat,
  team: GameTeam,
  seat: number
): boolean {
  return getGamePositions(format).some(
    (position) => position.team === team && position.seat === seat
  );
}

function getGamePositions(format: GameFormat): readonly GamePosition[] {
  return format === 'duel' ? DUEL_POSITIONS : TEAM_POSITIONS;
}
