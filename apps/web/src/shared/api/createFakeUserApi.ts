import type {
  AvatarPresetId,
  PublicUser,
  UserFinishedGame,
  UserGameParticipant,
  UserGamesResponse,
} from '@war-chest/api-contracts';
import type {
  FakeDatabase,
  FakeGame,
  FakeGameParticipant,
  FakeUser,
} from '@war-chest/fake-database';
import { ApiClientError } from './ApiClientError';
import { createFakePublicUser } from './createFakePublicUser';
import { getFakeDatabase } from './getFakeDatabase';

const HISTORY_PAGE_LIMIT = 20;

interface FakeUserApi {
  getPublicUser(this: void, userId: string): Promise<PublicUser>;
  listFinishedGames(
    this: void,
    userId: string,
    cursor?: string
  ): Promise<UserGamesResponse>;
  removeAvatar(this: void): Promise<PublicUser>;
  selectAvatarPreset(this: void, presetId: AvatarPresetId): Promise<PublicUser>;
  updateDisplayName(this: void, displayName: string): Promise<PublicUser>;
  uploadAvatar(this: void, dataUrl: string): Promise<PublicUser>;
}

export function createFakeUserApi(authenticatedUserId: string): FakeUserApi {
  return {
    getPublicUser,
    listFinishedGames,
    removeAvatar,
    selectAvatarPreset,
    updateDisplayName,
    uploadAvatar,
  };

  async function getPublicUser(userId: string): Promise<PublicUser> {
    const database = await getFakeDatabase();
    const user = await database.users.getById(userId);

    if (user === null) {
      throw createUserNotFoundError(userId);
    }

    return createFakePublicUser(user);
  }

  async function listFinishedGames(
    userId: string,
    encodedCursor?: string
  ): Promise<UserGamesResponse> {
    const database = await getFakeDatabase();
    const user = await database.users.getById(userId);

    if (user === null) {
      throw createUserNotFoundError(userId);
    }

    const cursor =
      encodedCursor === undefined ? undefined : decodeCursor(encodedCursor);
    const finishedGames = (await database.games.listGamesForUser(userId))
      .filter(isFinishedGame)
      .filter((game) => isAfterCursor(game, cursor))
      .sort(compareFinishedGames)
      .slice(0, HISTORY_PAGE_LIMIT + 1);
    const pageGames = finishedGames.slice(0, HISTORY_PAGE_LIMIT);
    const items = await Promise.all(
      pageGames.map((game) => createHistoryItem(database, game, userId))
    );
    const lastItem = items.at(-1);

    return {
      items,
      nextCursor:
        finishedGames.length > HISTORY_PAGE_LIMIT && lastItem !== undefined
          ? encodeCursor({
              finishedAt: lastItem.finishedAt,
              gameId: lastItem.id,
            })
          : null,
    };
  }

  function removeAvatar(): Promise<PublicUser> {
    return updateUser({ avatarDataUrl: null, avatarPresetId: null });
  }

  function selectAvatarPreset(presetId: AvatarPresetId): Promise<PublicUser> {
    return updateUser({ avatarDataUrl: null, avatarPresetId: presetId });
  }

  function updateDisplayName(displayName: string): Promise<PublicUser> {
    return updateUser({ displayName });
  }

  function uploadAvatar(dataUrl: string): Promise<PublicUser> {
    if (!/^data:image\/(?:jpeg|png|webp);base64,/u.test(dataUrl)) {
      return Promise.reject(
        new ApiClientError({
          code: 'avatar_invalid',
          diagnosticMessage: 'The fake avatar must be a supported image.',
        })
      );
    }

    return updateUser({ avatarDataUrl: dataUrl, avatarPresetId: null });
  }

  async function updateUser(
    changes: Partial<{
      avatarDataUrl: string | null;
      avatarPresetId: AvatarPresetId | null;
      displayName: string;
    }>
  ): Promise<PublicUser> {
    const database = await getFakeDatabase();
    const user = await database.users.getById(authenticatedUserId);

    if (user === null) {
      throw createUserNotFoundError(authenticatedUserId);
    }

    const updatedUser = { ...user, ...changes };
    await database.users.save(updatedUser);
    return createFakePublicUser(updatedUser);
  }
}

interface FinishedFakeGame extends FakeGame {
  finishedAt: Date;
  status: 'finished';
  winnerTeam: 'black' | 'white';
}

interface HistoryCursor {
  finishedAt: string;
  gameId: string;
}

async function createHistoryItem(
  database: FakeDatabase,
  game: FinishedFakeGame,
  userId: string
): Promise<UserFinishedGame> {
  const participant = await database.games.getParticipant(game.id, userId);

  if (participant === null) {
    throw createInvalidHistoryError(
      `Fake game ${game.id} is missing participant ${userId}.`
    );
  }

  const participants = await loadParticipants(database, game.id);

  return {
    finishedAt: game.finishedAt.toISOString(),
    id: game.id,
    participants,
    result: participant.team === game.winnerTeam ? 'victory' : 'defeat',
    team: participant.team,
    winnerTeam: game.winnerTeam,
  };
}

async function loadParticipants(
  database: FakeDatabase,
  gameId: string
): Promise<UserGameParticipant[]> {
  const participants = await database.games.listParticipants(gameId);

  return Promise.all(
    participants.map(async (participant) => {
      const user = await database.users.getById(participant.userId);

      if (user === null) {
        throw createInvalidHistoryError(
          `Fake game ${gameId} references missing user ${participant.userId}.`
        );
      }

      return createHistoryParticipant(participant, user);
    })
  );
}

function createHistoryParticipant(
  participant: FakeGameParticipant,
  user: FakeUser
): UserGameParticipant {
  return {
    ...createFakePublicUser(user),
    seat: participant.seat,
    team: participant.team,
  };
}

function isFinishedGame(game: FakeGame): game is FinishedFakeGame {
  return (
    game.status === 'finished' &&
    game.finishedAt !== null &&
    game.winnerTeam !== null
  );
}

function isAfterCursor(
  game: FinishedFakeGame,
  cursor: HistoryCursor | undefined
): boolean {
  if (cursor === undefined) {
    return true;
  }

  const cursorTime = new Date(cursor.finishedAt).getTime();
  const gameTime = game.finishedAt.getTime();

  return (
    gameTime < cursorTime ||
    (gameTime === cursorTime && game.id.localeCompare(cursor.gameId) < 0)
  );
}

function compareFinishedGames(
  firstGame: FinishedFakeGame,
  secondGame: FinishedFakeGame
): number {
  const timeDifference =
    secondGame.finishedAt.getTime() - firstGame.finishedAt.getTime();

  return timeDifference === 0
    ? secondGame.id.localeCompare(firstGame.id)
    : timeDifference;
}

function encodeCursor(cursor: HistoryCursor): string {
  return btoa(JSON.stringify(cursor))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

function decodeCursor(encodedCursor: string): HistoryCursor {
  try {
    const base64 = encodedCursor.replaceAll('-', '+').replaceAll('_', '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const value: unknown = JSON.parse(atob(`${base64}${padding}`));

    if (!isHistoryCursor(value)) {
      throw new Error('Cursor payload is invalid.');
    }

    return value;
  } catch (error) {
    throw new ApiClientError({
      cause: error,
      code: 'invalid_cursor',
      diagnosticMessage: 'The fake game history cursor is invalid.',
    });
  }
}

function isHistoryCursor(value: unknown): value is HistoryCursor {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const cursor = value as Record<string, unknown>;
  const finishedAt = cursor.finishedAt;

  return (
    typeof finishedAt === 'string' &&
    Number.isFinite(new Date(finishedAt).getTime()) &&
    typeof cursor.gameId === 'string' &&
    cursor.gameId !== ''
  );
}

function createUserNotFoundError(userId: string): ApiClientError {
  return new ApiClientError({
    code: 'user_not_found',
    diagnosticMessage: `Fake user ${userId} was not found.`,
  });
}

function createInvalidHistoryError(diagnosticMessage: string): ApiClientError {
  return new ApiClientError({
    code: 'invalid_response',
    diagnosticMessage,
  });
}
