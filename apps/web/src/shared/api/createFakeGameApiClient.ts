import type { GameApi } from './GameApi';
import { getFakeBackendClient } from './getFakeBackendClient';

export function createFakeGameApiClient(): GameApi {
  const client = getFakeBackendClient();

  return {
    createGame: client.createGame,
    getGame: client.getGame,
    joinGame: client.joinGame,
    leaveGame: client.leaveGame,
    listLobbyGames: client.listLobbyGames,
    startGame: client.startGame,
    surrenderGame: client.surrenderGame,
    swapPlayerPositions: client.swapPlayerPositions,
  };
}
