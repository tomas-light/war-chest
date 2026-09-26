import { queryOptions, useQuery } from '@tanstack/react-query';
import { createSelectedUserApi, useTranslatedApiResult } from '#/shared/api';

export function usePublicUserQuery(userId: string) {
  const query = useQuery(
    queryOptions({
      enabled: userId !== '',
      queryFn: async () => {
        const userApi = await createSelectedUserApi();

        return userApi.getPublicUser(userId);
      },
      queryKey: ['users', userId, 'profile'],
    })
  );

  return useTranslatedApiResult(query);
}
