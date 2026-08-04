import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { BrowserRouter } from 'react-router';

const QUERY_CLIENT = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={QUERY_CLIENT}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}
