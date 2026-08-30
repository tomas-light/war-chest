import type { AvatarPresetId } from '@war-chest/api-contracts';
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
  findAvatar(userId: string): Promise<StoredAvatar | null>;
  findPublicUser(userId: string): Promise<PublicUser | null>;
  listFinishedGames(
    userId: string,
    options: { cursor?: UserGameCursor; limit: number }
  ): Promise<UserGamePage>;
  removeAvatar(userId: string): Promise<PublicUser | null>;
  saveAvatar(userId: string, avatar: CustomAvatar): Promise<PublicUser | null>;
  selectAvatarPreset(
    userId: string,
    presetId: AvatarPresetId
  ): Promise<PublicUser | null>;
  updateDisplayName(
    userId: string,
    displayName: string
  ): Promise<PublicUser | null>;
}

export interface CustomAvatar {
  content: Buffer;
  contentHash: string;
  contentType: string;
}

export type StoredAvatar =
  | ({ kind: 'custom' } & CustomAvatar)
  | { kind: 'preset'; presetId: AvatarPresetId };

export function createUserRepository(database: Database): UserRepository {
  return {
    findAvatar,
    findPublicUser,
    listFinishedGames,
    removeAvatar,
    saveAvatar,
    selectAvatarPreset,
    updateDisplayName,
  };

  async function findAvatar(userId: string): Promise<StoredAvatar | null> {
    const [avatar] = await database
      .select({
        avatarPresetId: users.avatarPresetId,
        content: userAvatars.content,
        contentHash: userAvatars.contentHash,
        contentType: userAvatars.contentType,
      })
      .from(users)
      .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);

    if (avatar?.content !== null && avatar?.content !== undefined) {
      return {
        content: avatar.content,
        contentHash: requireAvatarValue(avatar.contentHash),
        contentType: requireAvatarValue(avatar.contentType),
        kind: 'custom',
      };
    }

    return avatar?.avatarPresetId === null || avatar === undefined
      ? null
      : { kind: 'preset', presetId: avatar.avatarPresetId as AvatarPresetId };
  }

  async function findPublicUser(userId: string): Promise<PublicUser | null> {
    const [user] = await database
      .select({
        avatarHash: userAvatars.contentHash,
        avatarPresetId: users.avatarPresetId,
        displayName: users.displayName,
        id: users.id,
      })
      .from(users)
      .leftJoin(userAvatars, eq(userAvatars.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1);

    return user === undefined ? null : toPublicUser(user);
  }

  async function updateDisplayName(
    userId: string,
    displayName: string
  ): Promise<PublicUser | null> {
    await database
      .update(users)
      .set({ displayName })
      .where(eq(users.id, userId));
    return findPublicUser(userId);
  }

  async function selectAvatarPreset(
    userId: string,
    presetId: AvatarPresetId
  ): Promise<PublicUser | null> {
    await database.transaction(async (transaction) => {
      await transaction
        .update(users)
        .set({ avatarPresetId: presetId })
        .where(eq(users.id, userId));
      await transaction
        .delete(userAvatars)
        .where(eq(userAvatars.userId, userId));
    });
    return findPublicUser(userId);
  }

  async function saveAvatar(
    userId: string,
    avatar: CustomAvatar
  ): Promise<PublicUser | null> {
    await database.transaction(async (transaction) => {
      await transaction
        .insert(userAvatars)
        .values({ ...avatar, userId })
        .onConflictDoUpdate({
          set: avatar,
          target: userAvatars.userId,
        });
      await transaction
        .update(users)
        .set({ avatarPresetId: null })
        .where(eq(users.id, userId));
    });
    return findPublicUser(userId);
  }

  async function removeAvatar(userId: string): Promise<PublicUser | null> {
    await database.transaction(async (transaction) => {
      await transaction
        .delete(userAvatars)
        .where(eq(userAvatars.userId, userId));
      await transaction
        .update(users)
        .set({ avatarPresetId: null })
        .where(eq(users.id, userId));
    });
    return findPublicUser(userId);
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

function toPublicUser(user: {
  avatarHash: string | null;
  avatarPresetId: string | null;
  displayName: string;
  id: string;
}): PublicUser {
  return createPublicUser({
    avatarVersion:
      user.avatarHash ??
      (user.avatarPresetId === null ? null : `preset:${user.avatarPresetId}`),
    displayName: user.displayName,
    id: user.id,
  });
}

function requireAvatarValue(value: string | null): string {
  if (value === null) {
    throw new Error('Stored avatar is incomplete.');
  }

  return value;
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
