import { Suspense } from 'react';
import { AppProviders } from '../providers/AppProviders';
import { AppRouter } from '../router/AppRouter';

export function App() {
  return (
    <AppProviders>
      <Suspense fallback={null}>
        <AppRouter />
      </Suspense>
    </AppProviders>
  );
}
