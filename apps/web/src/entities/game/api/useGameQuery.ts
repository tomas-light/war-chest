import {
  type QueryClient,
  queryOptions,
  useQuery,
} from '@tanstack/react-query';
import type { GameResponse } from '@war-chest/api-contracts';
import type { GameView } from '@war-chest/game-engine';
import { createSelectedGameApi, useTranslatedApiResult } from '#/shared/api';

export function useGameQuery(gameId: string) {
  const query = useQuery(
    queryOptions({
      enabled: gameId !== '',
      queryFn: async () => {
        const gameApi = await createSelectedGameApi();

        return gameApi.getGame(gameId);
      },
      queryKey: getGameQueryKey(gameId),
    })
  );

  return useTranslatedApiResult(query);
}

export function getGameQueryKey(gameId: string) {
  return ['games', gameId] as const;
}

export function setCachedGame(queryClient: QueryClient, game: GameResponse) {
  queryClient.setQueryData(getGameQueryKey(game.gameId), game);
}

interface CacheGameViewInput {
  gameId: string;
  queryClient: QueryClient;
  view: GameView;
}

export function cacheGameView(input: CacheGameViewInput): void {
  const { gameId, queryClient, view } = input;

  if (gameId === '') {
    return;
  }

  queryClient.setQueryData<GameResponse>(
    getGameQueryKey(gameId),
    (cachedGame) => ({
      gameId,
      players: cachedGame?.players ?? [],
      view,
    })
  );
}

export function removeCachedGame(
  queryClient: QueryClient,
  gameId: string
): void {
  queryClient.removeQueries({ queryKey: getGameQueryKey(gameId) });
}
