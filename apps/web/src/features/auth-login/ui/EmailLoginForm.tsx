import { useEffect, useState } from 'react';
import { useAuthSession } from '#/entities/auth-session';
import { useApiErrorMessage } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { CodeStage } from './CodeStage';
import { EmailStage } from './EmailStage';
import { RegistrationStage } from './RegistrationStage';
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
      {stage === 'email' ? (
        <EmailStage
          email={email}
          isPending={isPending}
          onEmailChange={setEmail}
        />
      ) : null}

      {stage === 'code' ? (
        <CodeStage
          code={code}
          email={email}
          isPending={isPending}
          onCodeChange={setCode}
          onResendCode={() => void sendCode()}
          onReturnToEmail={returnToEmail}
          resendSeconds={resendSeconds}
        />
      ) : null}

      {stage === 'registration' ? (
        <RegistrationStage
          displayName={displayName}
          isPending={isPending}
          onDisplayNameChange={setDisplayName}
        />
      ) : null}

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
