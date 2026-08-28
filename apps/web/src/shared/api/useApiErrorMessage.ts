import { useTranslation } from '../i18n/useTranslation';
import { ApiClientError } from './ApiClientError';

export function useApiErrorMessage(): (error: unknown) => string {
  const { t } = useTranslation('shared/api', {
    keyPrefix: 'ApiErrors',
  });

  return getApiErrorMessage;

  function getApiErrorMessage(error: unknown): string {
    return t(error instanceof ApiClientError ? error.code : 'unknown');
  }
}
