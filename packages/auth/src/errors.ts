export type AuthErrorCode =
  | 'email_code_invalid'
  | 'email_code_rate_limited'
  | 'email_delivery_unavailable'
  | 'registration_ticket_invalid';

export class AuthError extends Error {
  override readonly name = 'AuthError';
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}
