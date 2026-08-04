import {
  type Database,
  type Game,
  type GameParticipant,
  gameParticipants,
  games,
  userAvatars,
  users,
} from '@war-chest/database';
import { and, asc, desc, eq, inArray, isNotNull, lt, or } from 'drizzle-orm';
import { type PublicUser, createPublicUser } from './PublicUser.js';

type GameTeam = NonNullable<Game['winnerTeam']>;

interface FinishedGameParticipant extends PublicUser {
  seat: number;
  team: GameTeam;
}

interface UserFinishedGame {
  finishedAt: Date;
  id: string;
  participants: readonly FinishedGameParticipant[];
  result: 'defeat' | 'victory';
  team: GameTeam;
  winnerTeam: GameTeam;
}

export interface UserGameCursor {
  finishedAt: Date;
  gameId: string;
}

export interface UserGamePage {
  items: readonly UserFinishedGame[];
  nextCursor: UserGameCursor | null;
}

export interface UserRepository {
  findPublicUser(userId: string): Promise<PublicUser | null>;
  listFinishedGames(
    userId: string,
    options: { cursor?: UserGameCursor; limit: number }
  ): Promise<UserGamePage>;
}

export function createUserRepository(database: Database): UserRepository {
  return { findPublicUser, listFinishedGames };

  async function findPublicUser(userId: string): Promise<PublicUser | null> {
    const [user] = await database
      .select({
        avatarHash: userAvatars.contentHash,
        displayName: users.displayName,
        id: users.id,
      })
      .from(users)
      .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);

    return user === undefined ? null : createPublicUser(user);
  }

  async function listFinishedGames(
    userId: string,
    options: { cursor?: UserGameCursor; limit: number }
  ): Promise<UserGamePage> {
    const cursorFilter =
      options.cursor === undefined
        ? undefined
        : or(
            lt(games.finishedAt, options.cursor.finishedAt),
            and(
              eq(games.finishedAt, options.cursor.finishedAt),
              lt(games.id, options.cursor.gameId)
            )
          );
    const gameRows = await database
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
          eq(gameParticipants.userId, userId),
          eq(gameParticipants.role, 'player'),
          eq(games.status, 'finished'),
          isNotNull(gameParticipants.team),
          isNotNull(games.finishedAt),
          isNotNull(games.winnerTeam),
          cursorFilter
        )
      )
      .orderBy(desc(games.finishedAt), desc(games.id))
      .limit(options.limit + 1);
    const hasNextPage = gameRows.length > options.limit;
    const pageRows = gameRows.slice(0, options.limit);
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
  }

  async function loadParticipants(
    gameIds: readonly string[]
  ): Promise<Map<string, FinishedGameParticipant[]>> {
    if (gameIds.length === 0) {
      return new Map();
    }

    const participantRows = await database
      .select({
        avatarHash: userAvatars.contentHash,
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
          eq(gameParticipants.role, 'player'),
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
        ...createPublicUser(participant),
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

function requireTeam(team: GameParticipant['team'], gameId: string): GameTeam {
  if (team === null) {
    throw new Error(`Finished game ${gameId} has an incomplete team result.`);
  }

  return team;
}
