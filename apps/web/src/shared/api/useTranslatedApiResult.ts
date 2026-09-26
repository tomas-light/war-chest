import { useApiErrorMessage } from './useApiErrorMessage';

type ResultWithTranslatedError<Result extends { error: Error | null }> =
  Result extends { error: infer ErrorValue }
    ? Omit<Result, 'error'> & {
        error: ErrorValue extends null ? null : string;
      }
    : never;

export function useTranslatedApiResult<Result extends { error: Error | null }>(
  result: Result
): ResultWithTranslatedError<Result> {
  const getApiErrorMessage = useApiErrorMessage();
  const error = result.error;

  return {
    ...result,
    error: error === null ? null : getApiErrorMessage(error),
  } as unknown as ResultWithTranslatedError<Result>;
}
