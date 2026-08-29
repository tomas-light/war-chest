import type {
  GameCommandData,
  GameView,
  GameViewEventData,
} from '@war-chest/game-engine';

export const API_ERROR_CODES = [
  'avatar_not_found',
  'command_id_conflict',
  'feature_flags_unavailable',
  'game_command_forbidden',
  'game_command_rejected',
  'game_not_found',
  'game_position_occupied',
  'game_version_conflict',
  'internal_error',
  'invalid_credentials',
  'invalid_cursor',
  'invalid_message',
  'invalid_oauth_state',
  'invalid_request',
  'not_found',
  'player_already_in_game',
  'provider_disabled',
  'provider_request_failed',
  'unauthorized',
  'user_not_found',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface PublicUser {
  avatarVersion: string | null;
  displayName: string;
  id: string;
}

export interface SessionResponse {
  expiresAt: string;
  user: PublicUser;
}

export interface GoogleLoginRequest {
  idToken: string;
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
