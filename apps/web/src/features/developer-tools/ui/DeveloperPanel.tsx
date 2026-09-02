import clsx from 'clsx';
import type { MouseEvent } from 'react';
import { useFeatureFlags } from '#/shared/api';
import { useDevBackendStore } from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { DeveloperBackendSelector } from './DeveloperBackendSelector';
import classes from './DeveloperPanel.module.scss';

interface Props {
  isOpen: boolean;
  onClose(this: void): void;
}

const CAMEL_CASE_WORD_BOUNDARY_PATTERN = /(?<=[a-z\d])(?=[A-Z])/g;

export function DeveloperPanel(props: Props) {
  const { isOpen, onClose } = props;
  const { t } = useTranslation('features/developer-tools', {
    keyPrefix: 'DeveloperPanel',
  });
  const backend = useDevBackendStore((state) => state.backend);
  const featureFlagsQuery = useFeatureFlags(backend);

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div
      aria-hidden={!isOpen}
      className={clsx(classes.drawer, {
        [classes.drawerOpen]: isOpen,
      })}
      onClick={handleOutsideClick}
    >
      <aside
        aria-label={t('label')}
        className={classes.panel}
        id="developer-panel"
        inert={!isOpen}
      >
        <header className={classes.header}>
          <h2 className={classes.title}>{t('title')}</h2>
          <Button className={classes.closeButton} onClick={onClose}>
            {t('close')}
          </Button>
        </header>

        <DeveloperBackendSelector />

        <section className={classes.featureFlags}>
          <h3 className={classes.sectionTitle}>{t('featureFlags')}</h3>

          {featureFlagsQuery.isPending ? (
            <p className={classes.message} role="status">
              {t('featureFlagsLoading')}
            </p>
          ) : null}

          {featureFlagsQuery.isError ? (
            <p className={classes.error} role="alert">
              {t('featureFlagsError')}
            </p>
          ) : null}

          {featureFlagsQuery.data === undefined ? null : (
            <ul className={classes.featureFlagList}>
              {Object.entries(featureFlagsQuery.data).map(
                ([featureFlagName, isEnabled]) => (
                  <li className={classes.featureFlag} key={featureFlagName}>
                    <span
                      className={classes.featureFlagName}
                      title={featureFlagName}
                    >
                      {formatFeatureFlagName(featureFlagName)}
                    </span>
                    <span className={classes.featureFlagState}>
                      <span
                        aria-hidden="true"
                        className={clsx(classes.featureFlagLamp, {
                          [classes.featureFlagLampEnabled]: isEnabled,
                        })}
                      />
                      {isEnabled
                        ? t('featureFlagEnabled')
                        : t('featureFlagDisabled')}
                    </span>
                  </li>
                )
              )}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );

  function handleOutsideClick(event: MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }
}

function formatFeatureFlagName(featureFlagName: string): string {
  return featureFlagName
    .replace(CAMEL_CASE_WORD_BOUNDARY_PATTERN, ' ')
    .toLowerCase();
}
