import { queryOptions, useQuery } from '@tanstack/react-query';
import { createSelectedGameApi, useTranslatedApiResult } from '#/shared/api';

interface Options {
  eventSequence: number;
  gameId: string;
  userId: string;
}

interface QueryOptions extends Options {
  enabled: boolean;
}

export function getGameEventsQueryOptions(options: Options) {
  const { eventSequence, gameId, userId } = options;

  return queryOptions({
    queryKey: ['game-events', gameId, userId, eventSequence],
    queryFn: async () => {
      const api = await createSelectedGameApi();
      return api.getGameEvents(gameId);
    },
    staleTime: Infinity,
    retry: false,
  });
}

export function useGameEventsQuery(options: QueryOptions) {
  return useTranslatedApiResult(
    useQuery({
      ...getGameEventsQueryOptions(options),
      enabled: options.enabled,
    })
  );
}
