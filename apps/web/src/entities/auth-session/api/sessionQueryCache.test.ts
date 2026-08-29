import { QueryClient } from '@tanstack/react-query';
import { expect, test } from 'vitest';
import { clearSessionScopedQueries } from './sessionQueryCache';

test('clears session-scoped queries while preserving the auth session', () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['auth', 'session'], { session: 'current' });
  queryClient.setQueryData(['games', 'lobby'], [{ id: 'game-one' }]);

  clearSessionScopedQueries(queryClient);

  expect(queryClient.getQueryData(['games', 'lobby'])).toBeUndefined();
  expect(queryClient.getQueryData(['auth', 'session'])).toEqual({
    session: 'current',
  });
});
