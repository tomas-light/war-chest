const FAKE_SESSION_LOCK_PREFIX = 'war-chest-fake-auth-session:';

export interface FakeSessionLock {
  release(this: void): void;
}

interface LockReleaseSignal {
  release(this: void): void;
  released: Promise<void>;
}

export function acquireFakeSessionLock(
  sessionId: string
): Promise<FakeSessionLock | null> {
  return new Promise<FakeSessionLock | null>((resolve, reject) => {
    let isAcquisitionSettled = false;

    void navigator.locks
      .request(
        `${FAKE_SESSION_LOCK_PREFIX}${sessionId}`,
        { ifAvailable: true },
        holdLock
      )
      .catch(handleRequestError);

    async function holdLock(lock: Lock | null): Promise<void> {
      isAcquisitionSettled = true;

      if (lock === null) {
        resolve(null);
        return;
      }

      const releaseSignal = createLockReleaseSignal();

      resolve({ release: releaseSignal.release });
      await releaseSignal.released;
    }

    function handleRequestError(error: unknown): void {
      if (!isAcquisitionSettled) {
        reject(normalizeLockError(error));
      }
    }
  });
}

function createLockReleaseSignal(): LockReleaseSignal {
  let release: () => void = ignoreRelease;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { release, released };
}

function ignoreRelease(): void {}

function normalizeLockError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error('The fake session lock request failed.', { cause: error });
}
