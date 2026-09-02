import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { TextField } from '#/shared/ui/text-field';
import classes from './CodeStage.module.scss';

interface Props {
  code: string;
  email: string;
  isPending: boolean;
  onCodeChange(this: void, code: string): void;
  onResendCode(this: void): void;
  onReturnToEmail(this: void): void;
  resendSeconds: number;
}

export function CodeStage(props: Props) {
  const {
    code,
    email,
    isPending,
    onCodeChange,
    onResendCode,
    onReturnToEmail,
    resendSeconds,
  } = props;
  const { t } = useTranslation('features/auth-login', {
    keyPrefix: 'CodeStage',
  });

  return (
    <>
      <p className={classes.description}>{t('codeDescription', { email })}</p>
      <TextField
        autoComplete="one-time-code"
        autoFocus
        className={classes.codeInput}
        disabled={isPending}
        id="login-code"
        inputMode="numeric"
        label={t('codeLabel')}
        maxLength={6}
        onChange={(event) =>
          onCodeChange(event.target.value.replace(/\D/g, ''))
        }
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
          onClick={onReturnToEmail}
          variant="secondary"
        >
          {t('changeEmail')}
        </Button>

        <Button
          disabled={isPending || resendSeconds > 0}
          onClick={onResendCode}
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
