import type {
  GameCommandData,
  GameView,
  GameViewEventData,
} from '@war-chest/game-engine';

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
  gameId: string | null;
  message: string;
}

export interface ClientToServerEvents {
  'game:command': (message: GameCommandMessage) => void;
  'game:join': (message: GameJoinMessage) => void;
  'game:leave': (message: GameLeaveMessage) => void;
  'game:sync': (message: GameSyncMessage) => void;
}

export interface ServerToClientEvents {
  'game:error': (message: GameErrorMessage) => void;
  'game:events': (message: GameEventsMessage) => void;
  'game:snapshot': (message: GameSnapshotMessage) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  userId: string;
}
