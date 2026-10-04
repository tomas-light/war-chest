import type { GameApi } from '../GameApi';
import { getFakeBackendClient } from './getFakeBackendClient';

export function createFakeGameApiClient(): GameApi {
  const client = getFakeBackendClient();

  return {
    cancelTurnDraft: client.cancelTurnDraft,
    completeCardSelection: client.completeCardSelection,
    confirmCardChoice: client.confirmCardChoice,
    confirmTurnDraft: client.confirmTurnDraft,
    createGame: client.createGame,
    getGame: client.getGame,
    getGameEvents: client.getGameEvents,
    getTurnDraft: client.getTurnDraft,
    joinGame: client.joinGame,
    leaveGame: client.leaveGame,
    listLobbyGames: client.listLobbyGames,
    listTurnHistory: client.listTurnHistory,
    passTurn: client.passTurn,
    saveTurnDraft: client.saveTurnDraft,
    startGame: client.startGame,
    surrenderGame: client.surrenderGame,
    swapPlayerPositions: client.swapPlayerPositions,
    updateGameSettings: client.updateGameSettings,
  };
}
