import { useState } from 'react';
import { type AuthProvider, useAuthSession } from '#/entities/auth-session';
import { webConfig } from '#/shared/config/webConfig';
import { Button } from '#/shared/ui/button';
import { GoogleLoginButton } from './GoogleLoginButton';
import classes from './LoginOptions.module.scss';

interface LoginOptionsProps {
  onAuthenticated(this: void): void;
}

export function LoginOptions({ onAuthenticated }: LoginOptionsProps) {
  const { backend, login } = useAuthSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingProvider, setPendingProvider] = useState<AuthProvider | null>(
    null
  );
  const isPending = pendingProvider !== null;

  return (
    <div className={classes.options}>
      {backend === 'real' && webConfig.GOOGLE_CLIENT_ID !== '' ? (
        <GoogleLoginButton
          clientId={webConfig.GOOGLE_CLIENT_ID}
          onCredential={handleGoogleCredential}
          onError={handleGoogleError}
        />
      ) : (
        <Button
          className={classes.providerButton}
          disabled={isPending || backend === 'real'}
          onClick={() => void handleLogin('google')}
        >
          {backend === 'real' ? 'Google не настроен' : 'Продолжить с Google'}
        </Button>
      )}
      <Button
        className={classes.providerButton}
        disabled={isPending}
        onClick={() => void handleLogin('telegram')}
      >
        Продолжить с Telegram
      </Button>
      <Button
        className={classes.providerButton}
        disabled={isPending}
        onClick={() => void handleLogin('yandex')}
      >
        Продолжить с Yandex ID
      </Button>
      {errorMessage === null ? null : (
        <p className={classes.error} role="alert">
          {errorMessage}
        </p>
      )}
      {backend === 'fake' ? (
        <p className={classes.hint}>
          Fake-режим создаёт отдельного тестового игрока для каждого способа
          входа в этой вкладке.
        </p>
      ) : null}
    </div>
  );

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
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось выполнить вход. Попробуйте ещё раз.'
      );
    } finally {
      setPendingProvider(null);
    }
  }

  function handleGoogleCredential(idToken: string): void {
    void handleLogin('google', idToken);
  }

  function handleGoogleError(error: Error): void {
    setErrorMessage(error.message);
  }
}
