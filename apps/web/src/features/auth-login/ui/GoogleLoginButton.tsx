import { useEffect, useRef } from 'react';
import classes from './LoginOptions.module.scss';

const GOOGLE_IDENTITY_SCRIPT_ID = 'google-identity-services';
const GOOGLE_IDENTITY_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize(options: {
        callback(response: GoogleCredentialResponse): void;
        client_id: string;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          shape: 'rectangular';
          size: 'large';
          text: 'continue_with';
          theme: 'outline';
          width: number;
        }
      ): void;
    };
  };
}

interface GoogleLoginButtonProps {
  clientId: string;
  onCredential(this: void, idToken: string): void;
  onError(this: void, error: Error): void;
}

export function GoogleLoginButton({
  clientId,
  onCredential,
  onError,
}: GoogleLoginButtonProps) {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCredentialRef.current = onCredential;
    onErrorRef.current = onError;
  }, [onCredential, onError]);

  useEffect(() => {
    let isDisposed = false;

    void renderGoogleButton();

    return () => {
      isDisposed = true;
    };

    async function renderGoogleButton(): Promise<void> {
      try {
        await loadGoogleIdentityServices();

        if (isDisposed || buttonContainerRef.current === null) {
          return;
        }

        const google = getGoogleIdentityServices();

        google.accounts.id.initialize({
          callback(response) {
            onCredentialRef.current(response.credential);
          },
          client_id: clientId,
        });
        buttonContainerRef.current.replaceChildren();
        google.accounts.id.renderButton(buttonContainerRef.current, {
          shape: 'rectangular',
          size: 'large',
          text: 'continue_with',
          theme: 'outline',
          width: 320,
        });
      } catch (error) {
        if (!isDisposed) {
          onErrorRef.current(
            error instanceof Error
              ? error
              : new Error('Google Identity Services could not be loaded.')
          );
        }
      }
    }
  }, [clientId]);

  return (
    <div
      ref={buttonContainerRef}
      aria-label="Загрузка входа через Google"
      className={classes.googleButton}
    />
  );
}

function loadGoogleIdentityServices(): Promise<void> {
  if (getOptionalGoogleIdentityServices() !== null) {
    return Promise.resolve();
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    `#${GOOGLE_IDENTITY_SCRIPT_ID}`
  );

  if (existingScript !== null) {
    return waitForGoogleScript(existingScript);
  }

  const script = document.createElement('script');

  script.id = GOOGLE_IDENTITY_SCRIPT_ID;
  script.async = true;
  script.src = GOOGLE_IDENTITY_SCRIPT_URL;
  document.head.append(script);

  return waitForGoogleScript(script);
}

function waitForGoogleScript(script: HTMLScriptElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (getOptionalGoogleIdentityServices() !== null) {
      resolve();
      return;
    }

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    function handleLoad(): void {
      resolve();
    }

    function handleError(): void {
      reject(new Error('Google Identity Services could not be loaded.'));
    }
  });
}

function getGoogleIdentityServices(): GoogleIdentityServices {
  const google = getOptionalGoogleIdentityServices();

  if (google === null) {
    throw new Error('Google Identity Services are unavailable.');
  }

  return google;
}

function getOptionalGoogleIdentityServices(): GoogleIdentityServices | null {
  const browserWindow = window as Window & {
    google?: GoogleIdentityServices;
  };

  return browserWindow.google ?? null;
}
