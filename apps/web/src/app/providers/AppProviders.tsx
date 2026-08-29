import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router';
import {
  AuthClientProvider,
  AuthSessionProvider,
  refreshAuthSessionAfterUnauthorized,
} from '#/entities/auth-session';
import { isUnauthorizedApiError } from '#/shared/api';

const QUERY_CLIENT = createQueryClient();

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={QUERY_CLIENT}>
      <AuthClientProvider>
        <BrowserRouter>
          <AuthSessionProvider>{children}</AuthSessionProvider>
        </BrowserRouter>
      </AuthClientProvider>
    </QueryClientProvider>
  );
}

function createQueryClient(): QueryClient {
  let authSessionRefreshPromise: Promise<void> | null = null;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
      },
    },
    mutationCache: new MutationCache({ onError: handleApiError }),
    queryCache: new QueryCache({ onError: handleApiError }),
  });

  return queryClient;

  function handleApiError(error: unknown): void {
    if (!isUnauthorizedApiError(error) || authSessionRefreshPromise !== null) {
      return;
    }

    authSessionRefreshPromise = refreshAuthSessionAfterUnauthorized(
      queryClient
    ).finally(() => {
      authSessionRefreshPromise = null;
    });
  }
}
