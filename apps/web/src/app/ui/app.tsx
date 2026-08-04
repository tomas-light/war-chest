import { lazy, Suspense } from 'react';
import { AppProviders } from '../providers/AppProviders';
import { AppRouter } from '../router/AppRouter';

const DeveloperDrawer = import.meta.env.DEV
  ? lazy(async () => {
      const { DeveloperDrawer: DeveloperDrawerComponent } =
        await import('#/widgets/developer-drawer');

      return { default: DeveloperDrawerComponent };
    })
  : null;

export function App() {
  return (
    <AppProviders>
      {DeveloperDrawer === null ? null : (
        <Suspense>
          <DeveloperDrawer />
        </Suspense>
      )}
      <AppRouter />
    </AppProviders>
  );
}
