import { lazy, Suspense, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { Button } from '#/shared/ui/button';
import classes from './SessionNavigation.module.scss';

const DeveloperPanel = import.meta.env.DEV
  ? lazy(async () => {
      const { DeveloperPanel: DeveloperPanelComponent } =
        await import('#/features/developer-tools');

      return { default: DeveloperPanelComponent };
    })
  : null;

export function SessionNavigation() {
  const { logout, session } = useAuthSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeveloperPanelOpen, setIsDeveloperPanelOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  return (
    <div className={classes.layout}>
      <header className={classes.header}>
        <Link className={classes.brand} to="/lobby">
          War Chest
        </Link>
        <nav aria-label="Основная навигация" className={classes.navigation}>
          <Link to="/lobby">Лобби</Link>
          <Link to="/profile">Профиль</Link>
          {DeveloperPanel === null ? null : (
            <button
              aria-controls="developer-panel"
              aria-expanded={isDeveloperPanelOpen}
              className={classes.developerButton}
              onClick={openDeveloperPanel}
              type="button"
            >
              Dev
            </button>
          )}
        </nav>
        <div className={classes.session}>
          <span>{session?.user.displayName}</span>
          <Button disabled={isLoggingOut} onClick={() => void handleLogout()}>
            Выйти
          </Button>
        </div>
      </header>
      {errorMessage === null ? null : (
        <p className={classes.error} role="alert">
          {errorMessage}
        </p>
      )}
      {DeveloperPanel === null || !isDeveloperPanelOpen ? null : (
        <Suspense>
          <DeveloperPanel onClose={closeDeveloperPanel} />
        </Suspense>
      )}
      <Outlet />
    </div>
  );

  function openDeveloperPanel(): void {
    setIsDeveloperPanelOpen(true);
  }

  function closeDeveloperPanel(): void {
    setIsDeveloperPanelOpen(false);
  }

  async function handleLogout(): Promise<void> {
    setErrorMessage(null);
    setIsLoggingOut(true);

    try {
      await logout();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Не удалось завершить сессию.'
      );
    } finally {
      setIsLoggingOut(false);
    }
  }
}
