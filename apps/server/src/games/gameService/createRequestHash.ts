import { createHash } from 'node:crypto';
import type {
  CanonicalizableObject,
  CanonicalizableValue,
  RequestIdentity,
} from './GameServiceTypes.js';

export function createRequestHash(requestIdentity: RequestIdentity): string {
  return createHash('sha256')
    .update(canonicalize(requestIdentity))
    .digest('hex');
}

function canonicalize(requestIdentity: RequestIdentity): string {
  const serializedValue = JSON.stringify(requestIdentity, sortObjectKeys);

  if (serializedValue === undefined) {
    throw new Error('Request identity contains a non-JSON value.');
  }

  return serializedValue;
}

function sortObjectKeys(
  _propertyName: string,
  value: CanonicalizableValue | undefined
): CanonicalizableValue | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const objectValue = value as CanonicalizableObject;

  return Object.fromEntries(
    Object.entries(objectValue).sort(([firstName], [secondName]) =>
      firstName.localeCompare(secondName)
    )
  );
}
