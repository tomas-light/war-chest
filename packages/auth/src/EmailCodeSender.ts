export interface SendLoginCodeInput {
  code: string;
  email: string;
  expiresAt: Date;
}

export interface EmailCodeSender {
  sendLoginCode(input: SendLoginCodeInput): Promise<void>;
}
