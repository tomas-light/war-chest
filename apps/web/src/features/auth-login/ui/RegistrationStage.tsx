import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { TextField } from '#/shared/ui/text-field';
import classes from './RegistrationStage.module.scss';

interface Props {
  displayName: string;
  isPending: boolean;
  onDisplayNameChange(this: void, displayName: string): void;
}

export function RegistrationStage(props: Props) {
  const { displayName, isPending, onDisplayNameChange } = props;
  const { t } = useTranslation('features/auth-login', {
    keyPrefix: 'RegistrationStage',
  });

  return (
    <>
      <p className={classes.description}>{t('registrationDescription')}</p>

      <TextField
        autoComplete="nickname"
        autoFocus
        disabled={isPending}
        id="display-name"
        label={t('displayNameLabel')}
        maxLength={24}
        minLength={2}
        onChange={(event) => onDisplayNameChange(event.target.value)}
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
