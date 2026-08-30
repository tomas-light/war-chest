import { lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { EmailLoginForm } from '#/features/auth-login';
import { LanguageSelector } from '#/features/change-language';
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
  const location = useLocation();
  const navigate = useNavigate();
  const { refetch, status } = useAuthSession();
  const resolvedReturnTo = returnTo ?? getReturnTo(location.state);

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
      {status === 'pending' ? (
        <LoadingIndicator label={t('loadingLabel')} />
      ) : status === 'error' ? (
        <div className={classes.connectionError}>
          <p role="alert">{t('connectionError')}</p>
          <Button onClick={() => void refetch()}>{t('retry')}</Button>
        </div>
      ) : (
        <EmailLoginForm onAuthenticated={handleAuthenticated} />
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
