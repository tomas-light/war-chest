const BACKGROUND_TASK_RETRY_BASE_DELAY_MS = 1_000;
const BACKGROUND_TASK_RETRY_MAX_DELAY_MS = 60_000;

export function calculateBackgroundTaskRetryDelay(
  retryAttempt: number
): number {
  return Math.min(
    BACKGROUND_TASK_RETRY_BASE_DELAY_MS * 2 ** (retryAttempt - 1),
    BACKGROUND_TASK_RETRY_MAX_DELAY_MS
  );
}
