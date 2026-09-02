import type { AvatarPresetId } from '@war-chest/api-contracts';
import type { Game } from '@war-chest/database';
import type { PublicUser } from '../PublicUser.js';

export type GameTeam = NonNullable<Game['winnerTeam']>;

export interface FinishedGameParticipant extends PublicUser {
  seat: number;
  team: GameTeam;
}

export interface UserFinishedGame {
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
