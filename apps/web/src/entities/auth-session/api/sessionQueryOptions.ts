import { queryOptions } from '@tanstack/react-query';
import type { AuthClient } from '../model/AuthClient';

export const AUTH_SESSION_QUERY_KEY = ['auth', 'session'] as const;

export function sessionQueryOptions(authClientPromise: Promise<AuthClient>) {
  return queryOptions({
    queryFn: loadSession,
    queryKey: AUTH_SESSION_QUERY_KEY,
    retry: false,
  });

  async function loadSession() {
    const authClient = await authClientPromise;

    return {
      backend: authClient.backend,
      session: await authClient.getSession(),
    };
  }
}
