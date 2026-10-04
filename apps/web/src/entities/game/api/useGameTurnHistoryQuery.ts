import { useInfiniteQuery } from '@tanstack/react-query';
import type {
  GameTurnHistoryQuery,
  GameTurnHistoryResponse,
} from '@war-chest/api-contracts';
import { createSelectedGameApi, useTranslatedApiResult } from '#/shared/api';

interface Options {
  enabled: boolean;
  gameId: string;
}

const TURN_HISTORY_PAGE_SIZE = 20;

export function useGameTurnHistoryQuery(options: Options) {
  const { enabled, gameId } = options;

  const query = useInfiniteQuery<GameTurnHistoryResponse>({
    enabled,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as number | undefined,
    queryFn: async ({ pageParam }) => {
      const gameApi = await createSelectedGameApi();
      const query: GameTurnHistoryQuery = { limit: TURN_HISTORY_PAGE_SIZE };

      if (typeof pageParam === 'number') {
        query.beforeSequence = pageParam;
      }

      return gameApi.listTurnHistory(gameId, query);
    },
    queryKey: ['game-turn-history', gameId, TURN_HISTORY_PAGE_SIZE],
  });

  return useTranslatedApiResult(query);
}
