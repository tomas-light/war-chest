import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { AuthClient } from '../model/AuthClient';
import { useAuthClient } from '../model/AuthClientProvider';
import { clearSessionScopedQueries } from './sessionQueryCache';
import { sessionQueryOptions } from './sessionQueryOptions';

export function useLogout(): AuthClient['logout'] {
  const authClientPromise = useAuthClient();
  const queryClient = useQueryClient();
  const sessionQuery = sessionQueryOptions(authClientPromise);
  const { mutateAsync } = useMutation({ mutationFn: logout });

  return useCallback(() => mutateAsync(), [mutateAsync]);

  async function logout(): Promise<void> {
    const authClient = await authClientPromise;

    await authClient.logout();
    clearSessionScopedQueries(queryClient);
    queryClient.setQueryData(sessionQuery.queryKey, {
      backend: authClient.backend,
      session: null,
    });
  }
}
