import { type ReactNode, useEffect, useState } from 'react';
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { LanguageSelector } from '#/features/change-language';
import { ActiveGamePage } from '#/pages/active-game';
import { GamePage } from '#/pages/game';
import { GameHistoryPage } from '#/pages/game-history';
import { LobbyPage } from '#/pages/lobby';
import { LoginPage } from '#/pages/login';
import { NewGamePage } from '#/pages/new-game';
import { UserProfilePage } from '#/pages/user-profile';
import { appRoutes } from '#/shared/config';
import { useTranslation } from '#/shared/i18n/useTranslation';
import { Button } from '#/shared/ui/button';
import { LoadingIndicator } from '#/shared/ui/loading-indicator';
import { PlaceholderPage } from '#/shared/ui/placeholder-page';
import { GameRuntimeProvider } from '#/widgets/game-runtime';
import { SessionNavigation } from '#/widgets/session-navigation';
import classes from './AppRouter.module.scss';

const ROUTE_FADE_DURATION_MS = 200;

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AnonymousRoute />}>
        <Route path={appRoutes.login.url()} element={<LoginPage />} />
      </Route>
      <Route element={<AuthenticatedRoute />}>
        <Route element={<SessionNavigation />}>
          <Route
            index
            element={<Navigate replace to={appRoutes.lobby.url()} />}
          />
          <Route path={appRoutes.lobby.url()} element={<LobbyPage />} />
          <Route path={appRoutes.games.new.url()} element={<NewGamePage />} />
          <Route element={<GameRuntimeProvider />}>
            <Route
              path={appRoutes.games.gameId().url()}
              element={<GamePage />}
            />
            <Route
              path={appRoutes.games.play.gameId().url()}
              element={<ActiveGamePage />}
            />
          </Route>
          <Route path={appRoutes.profile.url()} element={<UserProfilePage />} />
          <Route
            path={appRoutes.users.userId().url()}
            element={<UserProfilePage />}
          />
          <Route
            path={appRoutes.history.gameId().url()}
            element={<GameHistoryPage />}
          />
          <Route
            path="*"
            element={<Navigate replace to={appRoutes.lobby.url()} />}
          />
        </Route>
      </Route>
    </Routes>
  );
}

function AnonymousRoute() {
  const { refetch, status } = useAuthSession();

  if (status === 'pending') {
    return <Outlet />;
  }

  if (status === 'error') {
    if (import.meta.env.DEV) {
      return <Outlet />;
    }

    return <SessionErrorPage onRetry={() => void refetch()} />;
  }

  if (status === 'authenticated') {
    return <Navigate replace to={appRoutes.lobby.url()} />;
  }

  return <Outlet />;
}

function AuthenticatedRoute() {
  const location = useLocation();
  const { refetch, status } = useAuthSession();
  const returnTo = `${location.pathname}${location.search}${location.hash}`;

  if (status === 'pending') {
    return (
      <SessionNavigation isSessionPending>
        <SessionLoadingPage />
      </SessionNavigation>
    );
  }

  if (status === 'error') {
    if (import.meta.env.DEV) {
      return <AnonymousLoginTransition returnTo={returnTo} />;
    }

    return <SessionErrorPage onRetry={() => void refetch()} />;
  }

  if (status === 'anonymous') {
    return <AnonymousLoginTransition returnTo={returnTo} />;
  }

  return (
    <SessionLoadingTransition preserveHeader>
      <Outlet />
    </SessionLoadingTransition>
  );
}

interface AnonymousLoginTransitionProps {
  returnTo: string;
}

function AnonymousLoginTransition(props: AnonymousLoginTransitionProps) {
  const { returnTo } = props;
  const navigate = useNavigate();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void navigate(appRoutes.login.url(), {
        replace: true,
        state: { returnTo },
      });
    }, getRouteFadeDurationMs());

    return () => window.clearTimeout(timeoutId);
  }, [navigate, returnTo]);

  return (
    <SessionLoadingTransition>
      <LoginPage returnTo={returnTo} />
    </SessionLoadingTransition>
  );
}

interface SessionLoadingTransitionProps {
  children: ReactNode;
  preserveHeader?: boolean;
}

function SessionLoadingTransition(props: SessionLoadingTransitionProps) {
  const { children, preserveHeader = false } = props;
  const [isLoadingPageVisible, setIsLoadingPageVisible] = useState(true);
  const pageClassName = preserveHeader
    ? classes.pageEnteringWithHeader
    : classes.pageEntering;

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setIsLoadingPageVisible(false),
      getRouteFadeDurationMs()
    );

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className={classes.transition}>
      <div className={pageClassName}>{children}</div>
      {isLoadingPageVisible ? (
        <SessionLoadingPage isLeaving preserveHeader={preserveHeader} />
      ) : null}
    </div>
  );
}

interface SessionLoadingPageProps {
  isLeaving?: boolean;
  preserveHeader?: boolean;
}

function SessionLoadingPage(props: SessionLoadingPageProps = {}) {
  const { isLeaving = false, preserveHeader = false } = props;
  const { t } = useTranslation('app/router', {
    keyPrefix: 'AppRouter',
  });
  const className = getLoadingPageClassName({ isLeaving, preserveHeader });

  return (
    <div aria-hidden={isLeaving || undefined} className={className}>
      <PlaceholderPage
        description={t('loadingDescription')}
        title={t('loadingTitle')}
      >
        <LoadingIndicator label={t('loadingLabel')} />
      </PlaceholderPage>
    </div>
  );
}

interface SessionErrorPageProps {
  onRetry(this: void): void;
}

function SessionErrorPage(props: SessionErrorPageProps) {
  const { onRetry } = props;
  const { t } = useTranslation('app/router', {
    keyPrefix: 'AppRouter',
  });

  return (
    <PlaceholderPage
      description={t('sessionErrorDescription')}
      logoHref="/"
      title={t('sessionErrorTitle')}
    >
      <div className={classes.sessionErrorActions}>
        <LanguageSelector />
        <Button onClick={onRetry}>{t('retry')}</Button>
      </div>
    </PlaceholderPage>
  );
}

function getRouteFadeDurationMs(): number {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : ROUTE_FADE_DURATION_MS;
}

function getLoadingPageClassName(
  options: Required<SessionLoadingPageProps>
): string {
  if (!options.isLeaving) {
    return classes.loadingPageEntering;
  }

  return options.preserveHeader
    ? classes.loadingPageLeavingWithHeader
    : classes.loadingPageLeaving;
}
