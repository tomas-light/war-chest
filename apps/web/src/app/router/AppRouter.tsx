import { Navigate, Route, Routes } from 'react-router';
import { GamePage } from '#/pages/game';
import { GameHistoryPage } from '#/pages/game-history';
import { LobbyPage } from '#/pages/lobby';
import { LoginPage } from '#/pages/login';
import { NewGamePage } from '#/pages/new-game';
import { UserProfilePage } from '#/pages/user-profile';
import { appRoutes } from './appRoutes';

export function AppRouter() {
  return (
    <Routes>
      <Route index element={<Navigate replace to={appRoutes.lobby.url()} />} />
      <Route path={appRoutes.login.url()} element={<LoginPage />} />
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
    </Routes>
  );
}
