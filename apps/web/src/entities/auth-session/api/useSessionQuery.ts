import { useQuery } from '@tanstack/react-query';
import { useAuthClient } from '../model/AuthClientProvider';
import { sessionQueryOptions } from './sessionQueryOptions';

export function useSessionQuery() {
  const authClientPromise = useAuthClient();

  return useQuery(sessionQueryOptions(authClientPromise));
}
