import clsx from 'clsx';
import { type ReactNode, lazy, Suspense, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { UserAvatar } from '#/entities/user';
import { LanguageSelector } from '#/features/change-language';
import { useApiErrorMessage } from '#/shared/api';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { WarChestLogo } from '#/shared/ui/war-chest-logo';
import classes from './SessionNavigation.module.scss';

const DeveloperPanel = import.meta.env.DEV
  ? lazy(async () => {
      const { DeveloperPanel: DeveloperPanelComponent } =
        await import('#/features/developer-tools');

      return { default: DeveloperPanelComponent };
    })
  : null;

interface Props {
  children?: ReactNode;
  isSessionPending?: boolean;
}

export function SessionNavigation(props: Props) {
  const { children, isSessionPending = false } = props;
  const { t } = useTranslation('widgets/session-navigation', {
    keyPrefix: 'SessionNavigation',
  });
  const getApiErrorMessage = useApiErrorMessage();
  const { logout, session } = useAuthSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeveloperPanelOpen, setIsDeveloperPanelOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  return (
    <div className={classes.layout}>
      <header className={classes.header}>
        <Link className={classes.brand} to="/lobby">
          <WarChestLogo className={classes.brandLogo} />
          <span className={classes.brandText}>War Chest</span>
        </Link>

        <nav aria-label={t('mainNavigation')} className={classes.navigation}>
          <Link to="/lobby">{t('lobby')}</Link>
          <Link to="/profile">{t('profile')}</Link>

          {DeveloperPanel === null ? null : (
            <button
              aria-controls="developer-panel"
              aria-expanded={isDeveloperPanelOpen}
              className={classes.developerButton}
              onClick={openDeveloperPanel}
              type="button"
            >
              {t('devTools')}
            </button>
          )}
        </nav>

        <div className={classes.session}>
          <LanguageSelector className={classes.languageSelector} />

          {session === null || session === undefined ? null : (
            <UserAvatar size="small" user={session.user} />
          )}

          <span
            className={clsx(classes.sessionName, {
              [classes.sessionLoading]: isSessionPending,
            })}
          >
            {isSessionPending ? t('sessionPending') : session?.user.displayName}
          </span>

          <Button
            disabled={isSessionPending || isLoggingOut}
            onClick={() => void handleLogout()}
          >
            {t('logout')}
          </Button>
        </div>
      </header>

      {errorMessage === null ? null : (
        <p className={classes.error} role="alert">
          {errorMessage}
        </p>
      )}

      {DeveloperPanel === null ? null : (
        <Suspense>
          <DeveloperPanel
            isOpen={isDeveloperPanelOpen}
            onClose={closeDeveloperPanel}
          />
        </Suspense>
      )}

      {children === undefined ? <Outlet /> : children}
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
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsLoggingOut(false);
    }
  }
}
