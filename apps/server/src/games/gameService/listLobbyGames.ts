import type { LobbyGame, LobbyGamesResponse } from '@war-chest/api-contracts';
import { createGamePlayers } from './createGamePlayers.js';
import type { GameServiceContext } from './GameServiceContext.js';
import type { ListLobbyGamesInput } from './GameServiceTypes.js';

export async function listLobbyGames(
  context: GameServiceContext,
  input: ListLobbyGamesInput
): Promise<LobbyGamesResponse> {
  const storedGames = await context.options.gameRepository.listLobbyGames();
  const currentPlayerGameId =
    await context.options.gameRepository.findCurrentPlayerGame(input.userId);

  return {
    currentPlayerGameId,
    items: storedGames.map(createLobbyGame),
  };

  function createLobbyGame(game: (typeof storedGames)[number]): LobbyGame {
    return {
      createdAt: game.createdAt.toISOString(),
      id: game.id,
      players: createGamePlayers(game.players),
      startedAt: game.startedAt?.toISOString() ?? null,
      status: game.status,
    };
  }
}
