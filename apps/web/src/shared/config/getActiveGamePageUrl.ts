import { appRoutes } from './appRoutes';

export function getActiveGamePageUrl(gameId: string): string {
  return appRoutes.games.play.gameId(gameId).url();
}
