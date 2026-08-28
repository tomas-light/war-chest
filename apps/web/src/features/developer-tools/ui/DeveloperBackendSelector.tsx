import type { ChangeEvent } from 'react';
import { type BackendKind, useDevBackendStore } from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import classes from './DeveloperBackendSelector.module.scss';

export function DeveloperBackendSelector() {
  const { t } = useTranslation('features/developer-tools', {
    keyPrefix: 'DeveloperBackendSelector',
  });
  const backend = useDevBackendStore((state) => state.backend);
  const setBackend = useDevBackendStore((state) => state.setBackend);

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <label className={classes.field}>
      <span>{t('backend')}</span>
      <select value={backend} onChange={handleBackendChange}>
        <option value="real">{t('realApi')}</option>
        <option value="fake">{t('fakeApi')}</option>
      </select>
    </label>
  );

  function handleBackendChange(event: ChangeEvent<HTMLSelectElement>): void {
    setBackend(event.target.value as BackendKind);
    window.location.reload();
  }
}
