import { Button } from '#/shared/ui/button';
import { DeveloperBackendSelector } from './DeveloperBackendSelector';
import classes from './DeveloperPanel.module.scss';

interface DeveloperPanelProps {
  onClose(this: void): void;
}

export function DeveloperPanel({ onClose }: DeveloperPanelProps) {
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <aside
      aria-label="Инструменты разработчика"
      className={classes.panel}
      id="developer-panel"
    >
      <header className={classes.header}>
        <h2 className={classes.title}>Dev-панель</h2>
        <Button className={classes.closeButton} onClick={onClose}>
          Закрыть
        </Button>
      </header>
      <DeveloperBackendSelector />
    </aside>
  );
}
