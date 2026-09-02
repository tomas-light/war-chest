import type { GameEventData } from '@war-chest/game-engine';

const REQUEST_HASH_PATTERN = /^[0-9a-f]{64}$/;

export function validateEventSequence(
  events: readonly GameEventData[],
  currentVersion: number
): void {
  for (const [index, event] of events.entries()) {
    const expectedSequence = currentVersion + index + 1;

    if (event.sequence !== expectedSequence) {
      throw new Error(
        `Event sequence ${event.sequence} does not follow ${currentVersion}.`
      );
    }
  }
}

export function validateNonEmptyEvents(events: readonly GameEventData[]): void {
  if (events.length === 0) {
    throw new Error('A saved command must contain at least one event.');
  }
}

export function validateRequestHash(requestHash: string): void {
  if (!REQUEST_HASH_PATTERN.test(requestHash)) {
    throw new Error('requestHash must be a lowercase SHA-256 hash.');
  }
}

export function validateExpectedVersion(expectedVersion: number): void {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
    throw new Error('expectedVersion must be a non-negative safe integer.');
  }
}
