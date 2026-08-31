export { createAuth } from './createAuth.js';
export type {
  Auth,
  CompleteRegistrationInput,
  CreateAuthOptions,
  EmailCodeRequestInput,
  EmailCodeRequestResult,
  LoginResult,
  VerifyEmailCodeInput,
  VerifyEmailCodeResult,
} from './createAuth.js';
export type { AuthUser } from './AuthUser.js';
export type { EmailCodeSender, SendLoginCodeInput } from './EmailCodeSender.js';
export { loadAuthConfig } from './config/index.js';
export type { AuthConfig, LoadAuthConfigOptions } from './config/index.js';
export { AuthError } from './errors.js';
export type { AuthErrorCode } from './errors.js';
export type { AuthCookie, AuthSession, SessionCookie } from './sessions.js';
