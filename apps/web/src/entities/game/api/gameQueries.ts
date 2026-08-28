import { queryOptions, useQuery } from '@tanstack/react-query';
import { createSelectedGameApi } from '#/shared/api';

export const LOBBY_GAMES_QUERY_KEY = ['games', 'lobby'] as const;

export function useLobbyGamesQuery(userId: string) {
  return useQuery(
    queryOptions({
      enabled: userId !== '',
      queryFn: async () => {
        const gameApi = await createSelectedGameApi({ userId });

        return gameApi.listLobbyGames();
      },
      queryKey: LOBBY_GAMES_QUERY_KEY,
    })
  );
}

export function useGameQuery(gameId: string, userId: string) {
  return useQuery(
    queryOptions({
      enabled: gameId !== '' && userId !== '',
      queryFn: async () => {
        const gameApi = await createSelectedGameApi({ userId });

        return gameApi.getGame(gameId);
      },
      queryKey: getGameQueryKey(gameId),
    })
  );
}

export function getGameQueryKey(gameId: string) {
  return ['games', gameId] as const;
}
