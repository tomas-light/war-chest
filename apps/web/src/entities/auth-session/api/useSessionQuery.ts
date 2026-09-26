import { useQuery } from '@tanstack/react-query';
import { useTranslatedApiResult } from '#/shared/api';
import { useAuthClient } from '../model/AuthClientProvider';
import { sessionQueryOptions } from './sessionQueryOptions';

export function useSessionQuery() {
  const authClientPromise = useAuthClient();

  const query = useQuery(sessionQueryOptions(authClientPromise));

  return useTranslatedApiResult(query);
}
