import type {
  GameCommandData,
  GameView,
  GameViewEventData,
} from '@war-chest/game-engine';

export const API_ERROR_CODES = [
  'avatar_not_found',
  'avatar_invalid',
  'avatar_too_large',
  'command_id_conflict',
  'feature_flags_unavailable',
  'game_command_forbidden',
  'game_command_rejected',
  'game_not_found',
  'game_position_occupied',
  'game_version_conflict',
  'internal_error',
  'email_code_invalid',
  'email_code_rate_limited',
  'email_delivery_unavailable',
  'invalid_cursor',
  'invalid_message',
  'invalid_request',
  'not_found',
  'player_already_in_game',
  'registration_ticket_invalid',
  'unauthorized',
  'user_not_found',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface PublicUser {
  avatarVersion: string | null;
  displayName: string;
  id: string;
}

export interface UserGameParticipant extends PublicUser {
  seat: number;
  team: 'black' | 'white';
}

export interface UserFinishedGame {
  finishedAt: string;
  id: string;
  participants: readonly UserGameParticipant[];
  result: 'defeat' | 'victory';
  team: 'black' | 'white';
  winnerTeam: 'black' | 'white';
}

export interface UserGamesResponse {
  items: readonly UserFinishedGame[];
  nextCursor: string | null;
}

export interface SessionResponse {
  expiresAt: string;
  user: PublicUser;
}

export const AVATAR_PRESETS = [
  {
    id: 'archer',
    imageUrl: '/game-images/concepts/base-game/archer/avatar.png',
  },
  {
    id: 'cavalry',
    imageUrl: '/game-images/concepts/base-game/cavalry/avatar.png',
  },
  {
    id: 'warrior-priest',
    imageUrl: '/game-images/concepts/base-game/warrior-priest/avatar.png',
  },
] as const;

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]['id'];

export interface RequestEmailCodeRequest {
  email: string;
}

export interface EmailCodeRequestedResponse {
  expiresAt: string;
  resendAvailableAt: string;
}

export interface VerifyEmailCodeRequest {
  code: string;
  email: string;
}

export type VerifyEmailCodeResponse =
  | {
      status: 'authenticated';
      session: SessionResponse;
    }
  | {
      expiresAt: string;
      registrationToken: string;
      status: 'registration_required';
    };

export interface CompleteEmailRegistrationRequest {
  displayName: string;
  registrationToken: string;
}

export interface UpdateCurrentUserRequest {
  displayName: string;
}

export interface SelectAvatarPresetRequest {
  presetId: AvatarPresetId;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface CreateGameRequest {
  commandId: string;
}

export interface GameResponse {
  gameId: string;
  players: readonly LobbyGamePlayer[];
  view: GameView;
}

export interface LobbyGamePlayer extends PublicUser {
  seat: number;
  team: 'black' | 'white';
}

export interface LobbyGame {
  createdAt: string;
  id: string;
  players: readonly LobbyGamePlayer[];
  startedAt: string | null;
  status: 'active' | 'waiting';
}

export interface LobbyGamesResponse {
  currentPlayerGameId: string | null;
  items: readonly LobbyGame[];
}

export interface JoinGameRequest {
  commandId: string;
  expectedVersion: number;
  seat: number;
  team: 'black' | 'white';
}

export interface LeaveGameRequest {
  commandId: string;
  expectedVersion: number;
}

export interface LeaveGameResponse {
  gameId: string;
}

export interface StartGameRequest {
  commandId: string;
  expectedVersion: number;
}

export interface SwapPlayerPositionsRequest {
  commandId: string;
  expectedVersion: number;
}

export interface SurrenderGameRequest {
  commandId: string;
  expectedVersion: number;
}

export interface GameEventsResponse {
  events: readonly GameViewEventData[];
  gameId: string;
}

export interface GameJoinMessage {
  gameId: string;
}

export interface GameLeaveMessage {
  gameId: string;
}

export interface GameSyncMessage {
  afterSequence: number;
  gameId: string;
}

export interface GameCommandMessage {
  command: GameCommandData;
  commandId: string;
  expectedVersion: number;
  gameId: string;
}

export interface GameSnapshotMessage {
  gameId: string;
  view: GameView;
}

export interface GameEventsMessage {
  events: readonly GameViewEventData[];
  gameId: string;
}

export interface GameErrorMessage {
  code: string;
  currentVersion?: number;
  gameId: string | null;
  message: string;
}

export interface LobbyUpdatedMessage {
  gameId: string;
}

export interface ClientToServerEvents {
  'game:command': (message: GameCommandMessage) => void;
  'game:join': (message: GameJoinMessage) => void;
  'game:leave': (message: GameLeaveMessage) => void;
  'game:sync': (message: GameSyncMessage) => void;
  'lobby:subscribe': (acknowledge: () => void) => void;
}

export interface ServerToClientEvents {
  'game:error': (message: GameErrorMessage) => void;
  'game:events': (message: GameEventsMessage) => void;
  'game:snapshot': (message: GameSnapshotMessage) => void;
  'lobby:updated': (message: LobbyUpdatedMessage) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: string;
}
