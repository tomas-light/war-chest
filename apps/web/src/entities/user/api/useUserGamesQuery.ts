import { useInfiniteQuery } from '@tanstack/react-query';
import type { UserGamesResponse } from '@war-chest/api-contracts';
import { createSelectedUserApi, useTranslatedApiResult } from '#/shared/api';

export function useUserGamesQuery(userId: string) {
  const query = useInfiniteQuery({
    enabled: userId !== '',
    getNextPageParam: (lastPage: UserGamesResponse) =>
      lastPage.nextCursor ?? undefined,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const userApi = await createSelectedUserApi();

      return userApi.listFinishedGames(userId, pageParam ?? undefined);
    },
    queryKey: ['users', userId, 'games'],
  });

  return useTranslatedApiResult(query);
}
