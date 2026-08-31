import {
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import type { UserGamesResponse } from '@war-chest/api-contracts';
import { createSelectedUserApi } from '#/shared/api';

export function usePublicUserQuery(userId: string) {
  return useQuery(
    queryOptions({
      enabled: userId !== '',
      queryFn: async () => {
        const userApi = await createSelectedUserApi();

        return userApi.getPublicUser(userId);
      },
      queryKey: ['users', userId, 'profile'],
    })
  );
}

export function useUserGamesQuery(userId: string) {
  return useInfiniteQuery({
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
}
