import type { Viewer } from '@war-chest/game-engine';

export function getPlayerViewer(userId: string): Viewer {
  return { playerId: userId, role: 'player' };
}
