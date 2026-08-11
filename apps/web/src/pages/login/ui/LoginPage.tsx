import { lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { LoginOptions } from '#/features/auth-login';
import { Button } from '#/shared/ui/button';
import { PlaceholderPage } from '#/shared/ui/placeholder-page';
import classes from './LoginPage.module.scss';

const DeveloperBackendSelector = import.meta.env.DEV
  ? lazy(async () => {
      const { DeveloperBackendSelector } =
        await import('#/features/developer-tools');

      return { default: DeveloperBackendSelector };
    })
  : null;

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refetch, status } = useAuthSession();
  const returnTo = getReturnTo(location.state);

  return (
    <PlaceholderPage
      description="Войдите через привычного провайдера. После проверки сервер создаст отдельную сессию War Chest."
      title="Вход"
    >
      {DeveloperBackendSelector === null ? null : (
        <div className={classes.developerTools}>
          <Suspense>
            <DeveloperBackendSelector />
          </Suspense>
        </div>
      )}
      {status === 'error' ? (
        <div className={classes.connectionError}>
          <p role="alert">
            Не удалось связаться с сервером и проверить сессию.
          </p>
          <Button onClick={() => void refetch()}>Повторить</Button>
        </div>
      ) : (
        <LoginOptions onAuthenticated={handleAuthenticated} />
      )}
    </PlaceholderPage>
  );

  function handleAuthenticated(): void {
    void navigate(returnTo, { replace: true });
  }
}

function getReturnTo(locationState: unknown): string {
  if (
    typeof locationState === 'object' &&
    locationState !== null &&
    'returnTo' in locationState &&
    typeof locationState.returnTo === 'string' &&
    locationState.returnTo.startsWith('/')
  ) {
    return locationState.returnTo;
  }

  return '/lobby';
}
