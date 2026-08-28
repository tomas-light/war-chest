import { lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { LoginOptions } from '#/features/auth-login';
import { LanguageSelector } from '#/features/change-language';
import { createApiClientError, useApiErrorMessage } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
import { PlaceholderPage } from '#/shared/ui/placeholder-page';
import classes from './LoginPage.module.scss';

const DeveloperBackendSelector = import.meta.env.DEV
  ? lazy(async () => {
      const { DeveloperBackendSelector } =
        await import('#/features/developer-tools');

      return { default: DeveloperBackendSelector };
    })
  : null;

interface Props {
  returnTo?: string;
}

export function LoginPage(props: Props) {
  const { returnTo } = props;
  const { t } = useTranslation('pages/login', {
    keyPrefix: 'LoginPage',
  });
  const getApiErrorMessage = useApiErrorMessage();
  const location = useLocation();
  const navigate = useNavigate();
  const { refetch, status } = useAuthSession();
  const resolvedReturnTo = returnTo ?? getReturnTo(location.state);
  const authErrorCode = new URLSearchParams(location.search).get('authError');
  const authErrorMessage =
    authErrorCode === null
      ? null
      : getApiErrorMessage(
          createApiClientError({
            code: authErrorCode,
            diagnosticMessage: `OAuth redirect failed with code ${authErrorCode}.`,
          })
        );

  return (
    <PlaceholderPage
      description={
        status === 'pending' ? t('loadingDescription') : t('description')
      }
      title={status === 'pending' ? t('loadingTitle') : t('title')}
    >
      <LanguageSelector className={classes.languageSelector} />
      {DeveloperBackendSelector === null ? null : (
        <div className={classes.developerTools}>
          <Suspense>
            <DeveloperBackendSelector />
          </Suspense>
        </div>
      )}
      {authErrorMessage === null ? null : (
        <p className={classes.authError} role="alert">
          {authErrorMessage}
        </p>
      )}
      {status === 'pending' ? (
        <LoadingIndicator label={t('loadingLabel')} />
      ) : status === 'error' ? (
        <div className={classes.connectionError}>
          <p role="alert">{t('connectionError')}</p>
          <Button onClick={() => void refetch()}>{t('retry')}</Button>
        </div>
      ) : (
        <LoginOptions onAuthenticated={handleAuthenticated} />
      )}
    </PlaceholderPage>
  );

  function handleAuthenticated(): void {
    void navigate(resolvedReturnTo, { replace: true });
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
