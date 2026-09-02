import {
  type Database,
  type Game,
  gameParticipants,
  games,
  userAvatars,
  users,
} from '@war-chest/database';
import { asc, desc, eq, inArray, or } from 'drizzle-orm';
import { createAvatarVersion } from './createAvatarVersion.js';
import type {
  StoredGamePlayer,
  StoredLobbyGame,
} from './GameRepositoryTypes.js';

export async function listLobbyGames(
  database: Database
): Promise<readonly StoredLobbyGame[]> {
  const gameRows = await database
    .select({
      createdAt: games.createdAt,
      id: games.id,
      startedAt: games.startedAt,
      status: games.status,
    })
    .from(games)
    .where(or(eq(games.status, 'waiting'), eq(games.status, 'active')))
    .orderBy(desc(games.createdAt));
  const gameIds = gameRows.map((game) => game.id);

  if (gameIds.length === 0) {
    return [];
  }

  const playerRows = await database
    .select({
      avatarHash: userAvatars.contentHash,
      avatarPresetId: users.avatarPresetId,
      displayName: users.displayName,
      gameId: gameParticipants.gameId,
      id: users.id,
      seat: gameParticipants.seat,
      team: gameParticipants.team,
    })
    .from(gameParticipants)
    .innerJoin(users, eq(users.id, gameParticipants.userId))
    .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
    .where(inArray(gameParticipants.gameId, gameIds))
    .orderBy(
      asc(gameParticipants.gameId),
      asc(gameParticipants.team),
      asc(gameParticipants.seat)
    );
  const playersByGameId = new Map<string, StoredGamePlayer[]>();

  for (const player of playerRows) {
    const players = playersByGameId.get(player.gameId) ?? [];
    const { avatarHash, avatarPresetId, gameId, ...storedPlayer } = player;

    players.push({
      ...storedPlayer,
      avatarVersion: createAvatarVersion(avatarHash, avatarPresetId),
    });
    playersByGameId.set(gameId, players);
  }

  return gameRows.map((game) => ({
    ...game,
    players: playersByGameId.get(game.id) ?? [],
    status: requireLobbyGameStatus(game.status, game.id),
  }));
}

function requireLobbyGameStatus(
  status: Game['status'],
  gameId: string
): StoredLobbyGame['status'] {
  if (status === 'finished') {
    throw new Error(`Finished game ${gameId} cannot appear in the lobby.`);
  }

  return status;
}
