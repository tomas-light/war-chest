import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { TextField } from '#/shared/ui/text-field';
import classes from './EmailStage.module.scss';

interface Props {
  email: string;
  isPending: boolean;
  onEmailChange(this: void, email: string): void;
}

export function EmailStage(props: Props) {
  const { email, isPending, onEmailChange } = props;
  const { t } = useTranslation('features/auth-login', {
    keyPrefix: 'EmailStage',
  });

  return (
    <>
      <TextField
        autoComplete="email"
        autoFocus
        disabled={isPending}
        id="login-email"
        label={t('emailLabel')}
        onChange={(event) => onEmailChange(event.target.value)}
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
