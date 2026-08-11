import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SessionResponse } from '@war-chest/api-contracts';
import { useCallback } from 'react';
import type { AuthClient, AuthProvider } from '../model/AuthClient';
import { useAuthClient } from '../model/AuthClientProvider';
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

  async function login({
    idToken,
    provider,
  }: LoginVariables): Promise<SessionResponse | null> {
    const authClient = await authClientPromise;
    const session = await authClient.login(provider, idToken);

    if (session !== null) {
      queryClient.setQueryData(sessionQuery.queryKey, {
        backend: authClient.backend,
        session,
      });
    }

    return session;
  }
}
