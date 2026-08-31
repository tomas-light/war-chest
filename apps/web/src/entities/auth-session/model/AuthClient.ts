import type {
  AvatarPresetId,
  EmailCodeRequestedResponse,
  PublicUser,
  SessionResponse,
  VerifyEmailCodeResponse,
} from '@war-chest/api-contracts';
import type { BackendKind } from '#/shared/config';

export interface AuthClient {
  readonly backend: BackendKind;
  completeEmailRegistration(
    this: void,
    registrationToken: string,
    displayName: string
  ): Promise<SessionResponse>;
  getSession(this: void): Promise<SessionResponse | null>;
  logout(this: void): Promise<void>;
  removeAvatar(this: void): Promise<PublicUser>;
  requestEmailCode(
    this: void,
    email: string
  ): Promise<EmailCodeRequestedResponse>;
  selectAvatarPreset(this: void, presetId: AvatarPresetId): Promise<PublicUser>;
  updateDisplayName(this: void, displayName: string): Promise<PublicUser>;
  uploadAvatar(this: void, file: File): Promise<PublicUser>;
  verifyEmailCode(
    this: void,
    email: string,
    code: string
  ): Promise<VerifyEmailCodeResponse>;
}
