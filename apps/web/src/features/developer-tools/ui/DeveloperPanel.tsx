import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { DeveloperBackendSelector } from './DeveloperBackendSelector';
import classes from './DeveloperPanel.module.scss';

interface Props {
  onClose(this: void): void;
}

export function DeveloperPanel(props: Props) {
  const { onClose } = props;
  const { t } = useTranslation('features/developer-tools', {
    keyPrefix: 'DeveloperPanel',
  });

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <aside
      aria-label={t('label')}
      className={classes.panel}
      id="developer-panel"
    >
      <header className={classes.header}>
        <h2 className={classes.title}>{t('title')}</h2>
        <Button className={classes.closeButton} onClick={onClose}>
          {t('close')}
        </Button>
      </header>
      <DeveloperBackendSelector />
    </aside>
  );
}
