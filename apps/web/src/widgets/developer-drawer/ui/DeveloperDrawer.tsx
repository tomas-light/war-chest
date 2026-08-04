import type { ChangeEvent } from 'react';
import { type BackendKind, useDevBackendStore } from '#/shared/config';
import classes from './DeveloperDrawer.module.scss';

export function DeveloperDrawer() {
  const backend = useDevBackendStore((state) => state.backend);
  const setBackend = useDevBackendStore((state) => state.setBackend);

  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <aside className={classes.drawer} aria-label="Инструменты разработчика">
      <label className={classes.field}>
        <span>Backend</span>
        <select value={backend} onChange={handleBackendChange}>
          <option value="real">Real</option>
          <option value="fake">Fake</option>
        </select>
      </label>
    </aside>
  );

  function handleBackendChange(event: ChangeEvent<HTMLSelectElement>): void {
    setBackend(event.target.value as BackendKind);
    window.location.reload();
  }
}
