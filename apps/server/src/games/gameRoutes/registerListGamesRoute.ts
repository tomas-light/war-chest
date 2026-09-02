import type { LobbyGamesResponse } from '@war-chest/api-contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getAuthenticatedUserId } from './gameRouteRequest.js';

export function registerListGamesRoute(app: FastifyInstance): void {
  app.get('/games', { preHandler: app.requireAuthSession }, listGames);

  function listGames(request: FastifyRequest): Promise<LobbyGamesResponse> {
    return app.serverDependencies.gameService.listLobbyGames({
      userId: getAuthenticatedUserId(request),
    });
  }
}
