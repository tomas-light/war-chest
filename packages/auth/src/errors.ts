export type AuthErrorCode =
  | 'invalid_credentials'
  | 'invalid_oauth_state'
  | 'provider_disabled'
  | 'provider_request_failed';

export class AuthError extends Error {
  override readonly name = 'AuthError';
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}
