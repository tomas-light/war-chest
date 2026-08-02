import type { ZodType } from 'zod';
import { AuthError } from '../errors.js';

export async function requestJson(
  url: string | URL,
  request: RequestInit
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, request);
  } catch (error) {
    throw new AuthError(
      'provider_request_failed',
      'Authentication provider request failed',
      { cause: error }
    );
  }

  if (!response.ok) {
    throw new AuthError(
      'provider_request_failed',
      `Authentication provider returned HTTP ${response.status}`
    );
  }

  try {
    return await response.json();
  } catch (error) {
    throw new AuthError(
      'provider_request_failed',
      'Authentication provider returned invalid JSON',
      { cause: error }
    );
  }
}

export function createBasicAuthorization(
  clientId: string,
  clientSecret: string
): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

export function parseProviderResponse<Output>(
  schema: ZodType<Output>,
  response: unknown
): Output {
  try {
    return schema.parse(response);
  } catch (error) {
    throw new AuthError(
      'provider_request_failed',
      'Authentication provider returned an invalid response',
      { cause: error }
    );
  }
}
