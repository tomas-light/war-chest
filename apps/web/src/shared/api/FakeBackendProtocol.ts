import type { SessionResponse } from '@war-chest/api-contracts';

export const FAKE_BACKEND_OPERATIONS = [
  'auth.getSession',
  'auth.login',
  'auth.loginExisting',
  'auth.logout',
  'featureFlags.read',
  'game.create',
  'game.get',
  'game.join',
  'game.leave',
  'game.listLobby',
  'game.start',
  'game.surrender',
  'game.swapPositions',
  'gameConnection.disconnect',
  'gameConnection.join',
  'gameConnection.leave',
  'gameConnection.synchronize',
  'lobby.subscribe',
  'lobby.unsubscribe',
  'user.getPublic',
  'user.listFinishedGames',
  'user.removeAvatar',
  'user.selectAvatarPreset',
  'user.updateDisplayName',
  'user.uploadAvatar',
] as const;

export const FAKE_BACKEND_EVENT_NAMES = [
  'game.error',
  'game.snapshot',
  'lobby.updated',
] as const;

export type FakeBackendOperation = (typeof FAKE_BACKEND_OPERATIONS)[number];
export type FakeBackendEventName = (typeof FAKE_BACKEND_EVENT_NAMES)[number];

export interface FakeLoginResult {
  session: SessionResponse;
  sessionId: string;
}

export interface FakeBackendRequest {
  operation: FakeBackendOperation;
  payload: unknown;
  requestId: number;
  type: 'request';
}

export interface FakeBackendError {
  code: string;
  message: string;
}

export type FakeBackendResponse =
  | {
      error: FakeBackendError;
      requestId: number;
      success: false;
      type: 'response';
    }
  | {
      requestId: number;
      result: unknown;
      success: true;
      type: 'response';
    };

export interface FakeBackendEventEnvelope {
  event: FakeBackendEventName;
  payload: unknown;
  subscriptionId: string;
  type: 'event';
}

export type FakeBackendWorkerMessage =
  FakeBackendEventEnvelope | FakeBackendResponse;

export function isFakeBackendRequest(
  value: unknown
): value is FakeBackendRequest {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.type === 'request' &&
    typeof value.requestId === 'number' &&
    Number.isSafeInteger(value.requestId) &&
    value.requestId > 0 &&
    typeof value.operation === 'string' &&
    FAKE_BACKEND_OPERATIONS.some(
      (operation) => operation === value.operation
    ) &&
    'payload' in value
  );
}

export function isFakeBackendWorkerMessage(
  value: unknown
): value is FakeBackendWorkerMessage {
  if (!isRecord(value)) {
    return false;
  }

  if (value.type === 'event') {
    return (
      typeof value.event === 'string' &&
      FAKE_BACKEND_EVENT_NAMES.some((eventName) => eventName === value.event) &&
      typeof value.subscriptionId === 'string' &&
      'payload' in value
    );
  }

  if (
    value.type !== 'response' ||
    typeof value.requestId !== 'number' ||
    typeof value.success !== 'boolean'
  ) {
    return false;
  }

  if (value.success) {
    return 'result' in value;
  }

  return (
    isRecord(value.error) &&
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
