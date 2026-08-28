import { useState } from 'react';
import { type AuthProvider, useAuthSession } from '#/entities/auth-session';
import { useApiErrorMessage } from '#/shared/api';
import { webConfig } from '#/shared/config/webConfig';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { GoogleLoginButton } from './GoogleLoginButton';
import classes from './LoginOptions.module.scss';

interface Props {
  onAuthenticated(this: void): void;
}

export function LoginOptions(props: Props) {
  const { onAuthenticated } = props;
  const { t } = useTranslation('features/auth-login', {
    keyPrefix: 'LoginOptions',
  });
  const getApiErrorMessage = useApiErrorMessage();
  const { backend, login } = useAuthSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<AuthProvider | null>(
    null
  );
  const isProviderPending = pendingProvider !== null;

  return (
    <div className={classes.options}>
      {renderGoogleLoginOption()}

      <Button
        className={classes.providerButton}
        disabled={isProviderPending}
        onClick={() => void handleLogin('telegram')}
      >
        {t('continueWithTelegram')}
      </Button>

      <Button
        className={classes.providerButton}
        disabled={isProviderPending}
        onClick={() => void handleLogin('yandex')}
      >
        {t('continueWithYandex')}
      </Button>

      {errorMessage === null ? null : (
        <p className={classes.error} role="alert">
          {errorMessage}
        </p>
      )}

      {backend === 'fake' ? (
        <p className={classes.hint}>{t('fakeModeHint')}</p>
      ) : null}
    </div>
  );

  function renderGoogleLoginOption() {
    if (backend === 'real' && webConfig.GOOGLE_CLIENT_ID !== '') {
      return (
        <GoogleLoginButton
          clientId={webConfig.GOOGLE_CLIENT_ID}
          onCredential={handleGoogleCredential}
          onError={handleGoogleError}
        />
      );
    }

    return (
      <Button
        className={classes.providerButton}
        disabled={isProviderPending || backend === 'real'}
        onClick={() => void handleLogin('google')}
      >
        {backend === 'real'
          ? t('googleNotConfigured')
          : t('continueWithGoogle')}
      </Button>
    );
  }

  async function handleLogin(
    provider: AuthProvider,
    idToken?: string
  ): Promise<void> {
    if (pendingProvider !== null) {
      return;
    }

    setErrorMessage(null);
    setPendingProvider(provider);

    try {
      const session = await login(provider, idToken);

      if (session !== null) {
        onAuthenticated();
      }
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setPendingProvider(null);
    }
  }

  function handleGoogleCredential(idToken: string): void {
    void handleLogin('google', idToken);
  }

  function handleGoogleError(error: Error): void {
    setErrorMessage(getApiErrorMessage(error));
  }
}
