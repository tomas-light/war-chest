import type { GameTeam } from '../../state.js';

interface GamePosition {
  seat: number;
  team: GameTeam;
}

const GAME_POSITIONS: readonly GamePosition[] = [
  { seat: 1, team: 'white' },
  { seat: 1, team: 'black' },
];

export const FIRST_PLAYER_SEAT = 1;
export const FIRST_PLAYER_TEAM: GameTeam = 'white';
export const REQUIRED_PLAYER_COUNT = GAME_POSITIONS.length;

export function isGamePosition(team: GameTeam, seat: number): boolean {
  return GAME_POSITIONS.some(
    (position) => position.team === team && position.seat === seat
  );
}
