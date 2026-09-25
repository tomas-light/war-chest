import clsx from 'clsx';
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { UserAvatar } from '#/entities/user';
import { LanguageSelector } from '#/features/change-language';
import { useApiErrorMessage } from '#/shared/api';
import { appRoutes } from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { WarChestLogo } from '#/shared/ui/war-chest-logo';
import GAME_ICON_BACK from '../assets/gameIconBack.svg';
import GAME_ICON_CLOSE_LOBBY from '../assets/gameIconCloseLobby.svg';
import GAME_ICON_MENU from '../assets/gameIconMenu.svg';
import GAME_ICON_SURRENDER from '../assets/gameIconSurrender.svg';
import classes from './GameHeader.module.scss';

const DeveloperPanel = import.meta.env.DEV
  ? lazy(async () => {
      const { DeveloperPanel: DeveloperPanelComponent } =
        await import('#/features/developer-tools');

      return { default: DeveloperPanelComponent };
    })
  : null;

export type GameSynchronizationState =
  'error' | 'pending' | 'ready' | 'resynchronizing';

interface Props {
  contextAction?: ReactNode;
  onBack(this: void): void;
  stage: string;
  synchronizationLabel?: string;
  synchronizationState?: GameSynchronizationState;
}

export function GameHeader(props: Props) {
  const {
    contextAction,
    onBack,
    stage,
    synchronizationLabel,
    synchronizationState,
  } = props;

  const { t } = useTranslation('widgets/game-navigation', {
    keyPrefix: 'GameHeader',
  });
  const getApiErrorMessage = useApiErrorMessage();
  const { logout, session } = useAuthSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeveloperPanelOpen, setIsDeveloperPanelOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const previousActiveElement = document.activeElement;
    const menuButtonElement = menuButtonRef.current;
    const firstFocusableElement = getFocusableElements(menuRef.current)[0];
    firstFocusableElement?.focus();

    return () => {
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      } else {
        menuButtonElement?.focus();
      }
    };
  }, [isMenuOpen]);

  return (
    <>
      <header className={classes.header}>
        <div className={classes.leftActions}>
          <button
            aria-label={t('back')}
            className={classes.iconButton}
            onClick={onBack}
            type="button"
          >
            <img alt="" className={classes.buttonIcon} src={GAME_ICON_BACK} />
          </button>
          <WarChestLogo className={classes.logo} />
          {synchronizationState === undefined ||
          synchronizationLabel === undefined ? null : (
            <span
              aria-label={synchronizationLabel}
              className={classes.synchronization}
              data-state={synchronizationState}
              role="status"
              tabIndex={0}
              title={synchronizationLabel}
            />
          )}
        </div>

        <h1 className={classes.stage}>{stage}</h1>

        <div className={classes.rightActions}>
          {contextAction}
          <button
            aria-expanded={isMenuOpen}
            aria-label={t('menu')}
            className={classes.iconButton}
            onClick={openMenu}
            ref={menuButtonRef}
            type="button"
          >
            <img alt="" className={classes.buttonIcon} src={GAME_ICON_MENU} />
          </button>
        </div>
      </header>

      {isMenuOpen ? (
        <div className={classes.menuBackdrop} onMouseDown={handleOutsideClick}>
          <aside
            aria-label={t('navigation')}
            aria-modal="true"
            className={classes.menu}
            onKeyDown={handleMenuKeyDown}
            ref={menuRef}
            role="dialog"
          >
            <header className={classes.menuHeader}>
              <WarChestLogo className={classes.menuLogo} />
              <button
                aria-label={t('closeMenu')}
                className={classes.iconButton}
                onClick={closeMenu}
                type="button"
              >
                <img
                  alt=""
                  className={classes.buttonIcon}
                  src={GAME_ICON_CLOSE_LOBBY}
                />
              </button>
            </header>

            <nav className={classes.menuNavigation}>
              <Link onClick={closeMenu} to={appRoutes.lobby.url()}>
                {t('lobby')}
              </Link>
              <button disabled title={t('rulesUnavailable')} type="button">
                {t('rules')}
              </button>
              <Link onClick={closeMenu} to={appRoutes.profile.url()}>
                {t('profile')}
              </Link>
              {DeveloperPanel === null ? null : (
                <button onClick={openDeveloperPanel} type="button">
                  {t('devTools')}
                </button>
              )}
            </nav>

            <footer className={classes.menuFooter}>
              {session?.user === undefined ? null : (
                <Link
                  className={classes.profile}
                  onClick={closeMenu}
                  to={appRoutes.profile.url()}
                >
                  <UserAvatar size="small" user={session.user} />
                  <span>{session.user.displayName}</span>
                </Link>
              )}
              <LanguageSelector className={classes.languageSelector} />
              <button
                className={classes.logout}
                disabled={isLoggingOut}
                onClick={() => void handleLogout()}
                type="button"
              >
                {t('logout')}
              </button>
              {errorMessage === null ? null : (
                <p className={classes.error} role="alert">
                  {errorMessage}
                </p>
              )}
            </footer>
          </aside>
        </div>
      ) : null}

      {DeveloperPanel === null ? null : (
        <Suspense>
          <DeveloperPanel
            isOpen={isDeveloperPanelOpen}
            onClose={closeDeveloperPanel}
          />
        </Suspense>
      )}
    </>
  );

  function openMenu(): void {
    setIsMenuOpen(true);
  }

  function closeMenu(): void {
    setIsMenuOpen(false);
  }

  function openDeveloperPanel(): void {
    closeMenu();
    setIsDeveloperPanelOpen(true);
  }

  function closeDeveloperPanel(): void {
    setIsDeveloperPanelOpen(false);
  }

  function handleOutsideClick(event: MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) {
      closeMenu();
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = getFocusableElements(menuRef.current);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement?.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement?.focus();
    }
  }

  async function handleLogout(): Promise<void> {
    setErrorMessage(null);
    setIsLoggingOut(true);

    try {
      await logout();
    } catch (error: unknown) {
      setErrorMessage(getApiErrorMessage(error));
    } finally {
      setIsLoggingOut(false);
    }
  }
}

interface GameHeaderActionProps {
  disabled?: boolean;
  kind: 'close' | 'surrender';
  label: string;
  onClick(this: void): void;
}

export function GameHeaderAction(props: GameHeaderActionProps) {
  const { disabled = false, kind, label, onClick } = props;
  const actionIcon =
    kind === 'close' ? GAME_ICON_CLOSE_LOBBY : GAME_ICON_SURRENDER;

  return (
    <button
      aria-label={label}
      className={clsx(classes.iconButton, classes.contextAction)}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <img alt="" className={classes.actionIcon} src={actionIcon} />
    </button>
  );
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (container === null) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
    )
  );
}
