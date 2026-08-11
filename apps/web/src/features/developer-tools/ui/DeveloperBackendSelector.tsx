import type { ChangeEvent } from 'react';
import { type BackendKind, useDevBackendStore } from '#/shared/config';
import classes from './DeveloperBackendSelector.module.scss';

export function DeveloperBackendSelector() {
  const backend = useDevBackendStore((state) => state.backend);
  const setBackend = useDevBackendStore((state) => state.setBackend);

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <label className={classes.field}>
      <span>Backend</span>
      <select value={backend} onChange={handleBackendChange}>
        <option value="real">Real API</option>
        <option value="fake">Fake API</option>
      </select>
    </label>
  );

  function handleBackendChange(event: ChangeEvent<HTMLSelectElement>): void {
    setBackend(event.target.value as BackendKind);
    window.location.reload();
  }
}
