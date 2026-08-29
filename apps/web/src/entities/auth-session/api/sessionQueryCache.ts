import type { QueryClient } from '@tanstack/react-query';
import { AUTH_SESSION_QUERY_KEY } from './sessionQueryOptions';

export function clearSessionScopedQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({ predicate: isSessionScopedQuery });

  function isSessionScopedQuery(query: {
    queryKey: readonly unknown[];
  }): boolean {
    return !isAuthSessionQueryKey(query.queryKey);
  }
}

export async function refreshAuthSessionAfterUnauthorized(
  queryClient: QueryClient
): Promise<void> {
  clearSessionScopedQueries(queryClient);
  await queryClient.invalidateQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
}

function isAuthSessionQueryKey(queryKey: readonly unknown[]): boolean {
  const [scope, resource] = queryKey;
  const [authScope, authResource] = AUTH_SESSION_QUERY_KEY;

  return (
    queryKey.length === AUTH_SESSION_QUERY_KEY.length &&
    scope === authScope &&
    resource === authResource
  );
}
