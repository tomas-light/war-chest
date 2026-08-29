import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SessionResponse } from '@war-chest/api-contracts';
import { useCallback } from 'react';
import type { AuthClient, AuthProvider } from '../model/AuthClient';
import { useAuthClient } from '../model/AuthClientProvider';
import { clearSessionScopedQueries } from './sessionQueryCache';
import { sessionQueryOptions } from './sessionQueryOptions';

interface LoginVariables {
  idToken?: string;
  provider: AuthProvider;
}

export function useLogin(): AuthClient['login'] {
  const authClientPromise = useAuthClient();
  const queryClient = useQueryClient();
  const sessionQuery = sessionQueryOptions(authClientPromise);
  const { mutateAsync } = useMutation({ mutationFn: login });

  return useCallback(
    (provider, idToken) => mutateAsync({ idToken, provider }),
    [mutateAsync]
  );

  async function login(
    loginVariables: LoginVariables
  ): Promise<SessionResponse | null> {
    const { idToken, provider } = loginVariables;

    const authClient = await authClientPromise;
    const session = await authClient.login(provider, idToken);

    if (session !== null) {
      clearSessionScopedQueries(queryClient);
      queryClient.setQueryData(sessionQuery.queryKey, {
        backend: authClient.backend,
        session,
      });
    }

    return session;
  }
}
