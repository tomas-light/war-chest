import {
  type Database,
  type GameParticipant,
  gameParticipants,
  games,
  userAvatars,
  users,
} from '@war-chest/database';
import { and, asc, desc, eq, inArray, isNotNull, lt, or } from 'drizzle-orm';
import { toPublicUser } from './toPublicUser.js';
import type {
  FinishedGameParticipant,
  GameTeam,
  UserFinishedGame,
  UserGameCursor,
  UserGamePage,
} from './UserRepositoryTypes.js';

interface Input {
  cursor?: UserGameCursor;
  database: Database;
  limit: number;
  userId: string;
}

export async function listFinishedGames(input: Input): Promise<UserGamePage> {
  const cursorFilter =
    input.cursor === undefined
      ? undefined
      : or(
          lt(games.finishedAt, input.cursor.finishedAt),
          and(
            eq(games.finishedAt, input.cursor.finishedAt),
            lt(games.id, input.cursor.gameId)
          )
        );
  const gameRows = await input.database
    .select({
      finishedAt: games.finishedAt,
      id: games.id,
      team: gameParticipants.team,
      winnerTeam: games.winnerTeam,
    })
    .from(gameParticipants)
    .innerJoin(games, eq(games.id, gameParticipants.gameId))
    .where(
      and(
        eq(gameParticipants.userId, input.userId),
        eq(games.status, 'finished'),
        isNotNull(gameParticipants.team),
        isNotNull(games.finishedAt),
        isNotNull(games.winnerTeam),
        cursorFilter
      )
    )
    .orderBy(desc(games.finishedAt), desc(games.id))
    .limit(input.limit + 1);
  const hasNextPage = gameRows.length > input.limit;
  const pageRows = gameRows.slice(0, input.limit);
  const participantsByGame = await loadParticipants(
    pageRows.map((game) => game.id)
  );
  const items: UserFinishedGame[] = pageRows.map((game) => {
    const finishedAt = requireFinishedAt(game.finishedAt, game.id);
    const team = requireTeam(game.team, game.id);
    const winnerTeam = requireTeam(game.winnerTeam, game.id);
    const participants = participantsByGame.get(game.id);

    if (participants === undefined) {
      throw new Error(`Finished game ${game.id} has no player participants.`);
    }

    return {
      finishedAt,
      id: game.id,
      participants,
      result: team === winnerTeam ? 'victory' : 'defeat',
      team,
      winnerTeam,
    };
  });
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor:
      hasNextPage && lastItem !== undefined
        ? { finishedAt: lastItem.finishedAt, gameId: lastItem.id }
        : null,
  };

  async function loadParticipants(
    gameIds: readonly string[]
  ): Promise<Map<string, FinishedGameParticipant[]>> {
    if (gameIds.length === 0) {
      return new Map();
    }

    const participantRows = await input.database
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
      .where(
        and(
          inArray(gameParticipants.gameId, [...gameIds]),
          isNotNull(gameParticipants.seat),
          isNotNull(gameParticipants.team)
        )
      )
      .orderBy(
        asc(gameParticipants.gameId),
        asc(gameParticipants.team),
        asc(gameParticipants.seat)
      );
    const participantsByGame = new Map<string, FinishedGameParticipant[]>();

    for (const participant of participantRows) {
      const gameParticipantsList =
        participantsByGame.get(participant.gameId) ?? [];

      gameParticipantsList.push({
        ...toPublicUser(participant),
        seat: requireSeat(participant.seat, participant.gameId),
        team: requireTeam(participant.team, participant.gameId),
      });
      participantsByGame.set(participant.gameId, gameParticipantsList);
    }

    return participantsByGame;
  }
}

function requireFinishedAt(finishedAt: Date | null, gameId: string): Date {
  if (finishedAt === null) {
    throw new Error(`Finished game ${gameId} has no completion time.`);
  }

  return finishedAt;
}

function requireSeat(seat: number | null, gameId: string): number {
  if (seat === null) {
    throw new Error(`Player in finished game ${gameId} has no seat.`);
  }

  return seat;
}

function requireTeam(
  team: GameParticipant['team'] | null,
  gameId: string
): GameTeam {
  if (team === null) {
    throw new Error(`Finished game ${gameId} has an incomplete team result.`);
  }

  return team;
}
