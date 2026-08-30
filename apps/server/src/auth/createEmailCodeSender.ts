import type { EmailCodeSender, SendLoginCodeInput } from '@war-chest/auth';
import type { ServerConfig } from '../config/schema.js';

export function createEmailCodeSender(config: ServerConfig): EmailCodeSender {
  if (config.APP_ENV === 'development') {
    return { sendLoginCode };
  }

  throw new Error(
    'Production email delivery is not configured. Add a production EmailCodeSender before starting the server outside development.'
  );
}

function sendLoginCode(input: SendLoginCodeInput): Promise<void> {
  // Development deliberately avoids SMTP: the code is visible only in the
  // server terminal and is never returned to the browser.
  // eslint-disable-next-line no-console
  console.log(
    `✅✅✅ Login code for ${input.email}: ${input.code} (expires ${input.expiresAt.toISOString()})`
  );
  return Promise.resolve();
}
