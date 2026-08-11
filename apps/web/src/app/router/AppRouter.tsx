import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { GamePage } from '#/pages/game';
import { GameHistoryPage } from '#/pages/game-history';
import { LobbyPage } from '#/pages/lobby';
import { LoginPage } from '#/pages/login';
import { NewGamePage } from '#/pages/new-game';
import { UserProfilePage } from '#/pages/user-profile';
import { Button } from '#/shared/ui/button';
import { PlaceholderPage } from '#/shared/ui/placeholder-page';
import { SessionNavigation } from '#/widgets/session-navigation';
import { appRoutes } from './appRoutes';

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
          <Route path={appRoutes.games.gameId().url()} element={<GamePage />} />
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
    return <SessionLoadingPage />;
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

  if (status === 'pending') {
    return <SessionLoadingPage />;
  }

  if (status === 'error') {
    return <SessionErrorPage onRetry={() => void refetch()} />;
  }

  if (status === 'anonymous') {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;

    return <Navigate replace state={{ returnTo }} to={appRoutes.login.url()} />;
  }

  return <Outlet />;
}

function SessionLoadingPage() {
  return (
    <PlaceholderPage
      description="Проверяем действующую сессию War Chest."
      title="Загрузка"
    />
  );
}

function SessionErrorPage({ onRetry }: { onRetry(this: void): void }) {
  return (
    <PlaceholderPage
      description="Не удалось связаться с сервером и проверить сессию."
      title="Нет соединения"
    >
      <Button onClick={onRetry}>Повторить</Button>
    </PlaceholderPage>
  );
}
