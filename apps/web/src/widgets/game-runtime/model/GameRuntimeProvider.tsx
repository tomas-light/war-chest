import { createContext, useContext } from 'react';
import { matchPath, Outlet, useLocation } from 'react-router';
import { useAuthSession } from '#/entities/auth-session';
import { appRoutes } from '#/shared/config';
import { useGameRuntimeState } from './useGameRuntime';

type GameRuntimeState = ReturnType<typeof useGameRuntimeState>;

interface GameRuntime extends GameRuntimeState {
  gameId: string;
  userId: string;
}

const GameRuntimeContext = createContext<GameRuntime | null>(null);

export function GameRuntimeProvider() {
  const location = useLocation();
  const { session } = useAuthSession();
  const gameId = getGameId(location.pathname);
  const userId = session?.user.id ?? '';
  const runtime = useGameRuntimeState({ gameId, userId });

  return (
    <GameRuntimeContext.Provider value={{ ...runtime, gameId, userId }}>
      <Outlet />
    </GameRuntimeContext.Provider>
  );
}

export function useGameRuntime(): GameRuntime {
  const runtime = useContext(GameRuntimeContext);

  if (runtime === null) {
    throw new Error('useGameRuntime must be used inside GameRuntimeProvider.');
  }

  return runtime;
}

function getGameId(pathname: string): string {
  const activeGameMatch = matchPath(
    appRoutes.games.play.gameId().url(),
    pathname
  );
  const preparationGameMatch = matchPath(
    appRoutes.games.gameId().url(),
    pathname
  );

  return (
    activeGameMatch?.params.gameId ?? preparationGameMatch?.params.gameId ?? ''
  );
}
