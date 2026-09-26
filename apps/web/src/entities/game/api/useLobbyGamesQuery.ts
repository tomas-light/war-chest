import {
  type QueryClient,
  queryOptions,
  useQuery,
} from '@tanstack/react-query';
import { createSelectedGameApi, useTranslatedApiResult } from '#/shared/api';

export const LOBBY_GAMES_QUERY_KEY = ['games', 'lobby'] as const;

export function useLobbyGamesQuery() {
  const query = useQuery(
    queryOptions({
      queryFn: async () => {
        const gameApi = await createSelectedGameApi();

        return gameApi.listLobbyGames();
      },
      queryKey: LOBBY_GAMES_QUERY_KEY,
    })
  );

  return useTranslatedApiResult(query);
}

export function invalidateLobbyGames(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: LOBBY_GAMES_QUERY_KEY });
}
