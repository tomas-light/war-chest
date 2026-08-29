import { queryOptions, useQuery } from '@tanstack/react-query';
import { createSelectedGameApi } from '#/shared/api';

export const LOBBY_GAMES_QUERY_KEY = ['games', 'lobby'] as const;

export function useLobbyGamesQuery() {
  return useQuery(
    queryOptions({
      queryFn: async () => {
        const gameApi = await createSelectedGameApi();

        return gameApi.listLobbyGames();
      },
      queryKey: LOBBY_GAMES_QUERY_KEY,
    })
  );
}

export function useGameQuery(gameId: string) {
  return useQuery(
    queryOptions({
      enabled: gameId !== '',
      queryFn: async () => {
        const gameApi = await createSelectedGameApi();

        return gameApi.getGame(gameId);
      },
      queryKey: getGameQueryKey(gameId),
    })
  );
}

export function getGameQueryKey(gameId: string) {
  return ['games', gameId] as const;
}
