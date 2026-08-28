import { appRoutes } from './appRoutes';

export type GameOpenMode = 'join' | 'watch';

export function getGamePageUrl(gameId: string, mode?: GameOpenMode): string {
  const gameUrl = appRoutes.games.gameId(gameId).url();

  return mode === undefined ? gameUrl : `${gameUrl}?mode=${mode}`;
}
