import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useAuthSession } from '#/entities/auth-session';
import { useApiErrorMessage } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import classes from './EmailLoginForm.module.scss';

type Stage = 'code' | 'email' | 'registration';

interface Props {
  onAuthenticated(this: void): void;
}

export function EmailLoginForm(props: Props) {
  const { onAuthenticated } = props;
  const { t } = useTranslation('features/auth-login', {
    keyPrefix: 'EmailLoginForm',
  });
  const getApiErrorMessage = useApiErrorMessage();
  const {
    backend,
    completeEmailRegistration,
    requestEmailCode,
    verifyEmailCode,
  } = useAuthSession();
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [registrationToken, setRegistrationToken] = useState<string | null>(
    null
  );
  const [resendAvailableAt, setResendAvailableAt] = useState(0);
  const [now, setNow] = useState(0);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resendSeconds = Math.max(
    0,
    Math.ceil((resendAvailableAt - now) / 1000)
  );

  useEffect(() => {
    if (resendSeconds === 0) {
      return;
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [resendSeconds]);

  return (
    <form
      className={classes.form}
      onSubmit={(event) => {
        event.preventDefault();

        if (stage === 'email') {
          void sendCode();
        } else if (stage === 'code') {
          void checkCode();
        } else {
          void register();
        }
      }}
    >
      {stage === 'email' ? renderEmailStage() : null}
      {stage === 'code' ? renderCodeStage() : null}
      {stage === 'registration' ? renderRegistrationStage() : null}

      {errorMessage === null ? null : (
        <p className={classes.error} role="alert">
          {errorMessage}
        </p>
      )}

      {backend === 'fake' ? (
        <p className={classes.hint}>{t('fakeModeHint')}</p>
      ) : null}
    </form>
  );

  function renderEmailStage() {
    return (
      <>
        <label className={classes.label} htmlFor="login-email">
          {t('emailLabel')}
        </label>
        <input
          autoComplete="email"
          autoFocus
          className={classes.input}
          disabled={isPending}
          id="login-email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('emailPlaceholder')}
          required
          type="email"
          value={email}
        />
        <Button className={classes.submit} disabled={isPending} type="submit">
          {isPending ? t('sendingCode') : t('sendCode')}
        </Button>
      </>
    );
  }

  function renderCodeStage() {
    return (
      <>
        <p className={classes.description}>{t('codeDescription', { email })}</p>
        <label className={classes.label} htmlFor="login-code">
          {t('codeLabel')}
        </label>
        <input
          autoComplete="one-time-code"
          autoFocus
          className={clsx(classes.input, classes.codeInput)}
          disabled={isPending}
          id="login-code"
          inputMode="numeric"
          maxLength={6}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          pattern="\d{6}"
          required
          value={code}
        />
        <Button className={classes.submit} disabled={isPending} type="submit">
          {isPending ? t('checkingCode') : t('signIn')}
        </Button>
        <div className={classes.secondaryActions}>
          <Button
            disabled={isPending}
            onClick={returnToEmail}
            variant="secondary"
          >
            {t('changeEmail')}
          </Button>
          <Button
            disabled={isPending || resendSeconds > 0}
            onClick={() => void sendCode()}
            variant="secondary"
          >
            {resendSeconds > 0
              ? t('resendCountdown', { seconds: resendSeconds })
              : t('resendCode')}
          </Button>
        </div>
      </>
    );
  }

  function renderRegistrationStage() {
    return (
      <>
        <p className={classes.description}>{t('registrationDescription')}</p>
        <label className={classes.label} htmlFor="display-name">
          {t('displayNameLabel')}
        </label>
        <input
          autoComplete="nickname"
          autoFocus
          className={classes.input}
          disabled={isPending}
          id="display-name"
          maxLength={24}
          minLength={2}
          onChange={(event) => setDisplayName(event.target.value)}
          required
          value={displayName}
        />
        <p className={classes.requirements}>{t('displayNameRequirements')}</p>
        <Button className={classes.submit} disabled={isPending} type="submit">
          {isPending ? t('creatingProfile') : t('createProfile')}
        </Button>
      </>
    );
  }

  async function sendCode(): Promise<void> {
    await run(async () => {
      const result = await requestEmailCode(email);

      setResendAvailableAt(new Date(result.resendAvailableAt).getTime());
      setNow(Date.now());
      setStage('code');
    });
  }

  async function checkCode(): Promise<void> {
    await run(async () => {
      const result = await verifyEmailCode(email, code);

      if (result.status === 'authenticated') {
        onAuthenticated();
        return;
      }

      setRegistrationToken(result.registrationToken);
      setStage('registration');
    });
  }

  async function register(): Promise<void> {
    if (registrationToken === null) {
      returnToEmail();
      return;
    }

    await run(async () => {
      await completeEmailRegistration(registrationToken, displayName);
      onAuthenticated();
    });
  }

  async function run(action: () => Promise<void>): Promise<void> {
    if (isPending) {
      return;
    }

    setErrorMessage(null);
    setIsPending(true);

    try {
      await action();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsPending(false);
    }
  }

  function returnToEmail(): void {
    setCode('');
    setRegistrationToken(null);
    setErrorMessage(null);
    setStage('email');
  }
}
