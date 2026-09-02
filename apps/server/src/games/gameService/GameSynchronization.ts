import {
  type GameViewEventData,
  createViewEventFor,
  createViewFor,
} from '@war-chest/game-engine';
import type { GameRepository } from '../GameRepository.js';
import type {
  CreateSynchronizationInput,
  CreateViewEventTailInput,
  GameSynchronization as GameSynchronizationResult,
  ValidateEventTailInput,
} from './GameServiceTypes.js';

export interface GameSynchronization {
  create(
    this: void,
    input: CreateSynchronizationInput
  ): Promise<GameSynchronizationResult>;
  createViewEventTail(
    this: void,
    input: CreateViewEventTailInput
  ): Promise<readonly GameViewEventData[]>;
}

export function createGameSynchronization(
  gameRepository: GameRepository
): GameSynchronization {
  return { create, createViewEventTail };

  async function create(
    input: CreateSynchronizationInput
  ): Promise<GameSynchronizationResult> {
    if (input.afterSequence > input.state.lastEventSequence) {
      return {
        type: 'snapshot',
        view: createViewFor(input.state, input.viewer),
      };
    }

    return {
      events: await createViewEventTail({
        afterSequence: input.afterSequence,
        currentVersion: input.state.lastEventSequence,
        gameId: input.gameId,
        viewer: input.viewer,
      }),
      type: 'events',
    };
  }

  async function createViewEventTail(
    input: CreateViewEventTailInput
  ): Promise<readonly GameViewEventData[]> {
    const events = await gameRepository.loadEvents(
      input.gameId,
      input.afterSequence
    );
    validateEventTail({
      afterSequence: input.afterSequence,
      currentVersion: input.currentVersion,
      events,
      gameId: input.gameId,
    });

    return events.map((event) => createViewEventFor(event, input.viewer));
  }
}

function validateEventTail(input: ValidateEventTailInput): void {
  for (const [index, event] of input.events.entries()) {
    const expectedSequence = input.afterSequence + index + 1;

    if (event.sequence !== expectedSequence) {
      throw new Error(
        `Stored game ${input.gameId} has a sequence gap before ${event.sequence}.`
      );
    }
  }

  const lastSequence = input.events.at(-1)?.sequence ?? input.afterSequence;

  if (lastSequence !== input.currentVersion) {
    throw new Error(
      `Stored game ${input.gameId} history ends at ${lastSequence}, expected ${input.currentVersion}.`
    );
  }
}
