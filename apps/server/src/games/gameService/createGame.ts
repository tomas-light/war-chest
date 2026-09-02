import type { RuntimeFeatureFlags } from '@war-chest/feature-flags';
import {
  applyEvent,
  createGame as createGameEvent,
  createViewFor,
} from '@war-chest/game-engine';
import { createRequestHash } from './createRequestHash.js';
import type { GameServiceContext } from './GameServiceContext.js';
import type {
  CreateGameInput,
  CreateGameResult,
  DuplicateCreateGameResult,
} from './GameServiceTypes.js';

export async function createGame(
  context: GameServiceContext,
  input: CreateGameInput
): Promise<CreateGameResult> {
  const requestHash = createRequestHash({
    operation: 'CreateGame',
    userId: input.userId,
  });
  const existingCommand =
    await context.options.gameRepository.findProcessedCommand(input.commandId);

  if (existingCommand !== null) {
    const isExactDuplicate =
      existingCommand.userId === input.userId &&
      existingCommand.commandType === 'CreateGame' &&
      existingCommand.requestHash === requestHash;

    if (!isExactDuplicate) {
      return { status: 'commandIdConflict' };
    }

    return loadDuplicateCreatedGame(existingCommand.gameId, input.userId);
  }

  const currentPlayerGameId =
    await context.options.gameRepository.findCurrentPlayerGame(input.userId);

  if (currentPlayerGameId !== null) {
    return { gameId: currentPlayerGameId, status: 'playerAlreadyInGame' };
  }

  let featureFlags: RuntimeFeatureFlags;

  try {
    featureFlags = await context.options.featureFlagsService.read();
  } catch {
    return { status: 'featureFlagsUnavailable' };
  }

  const gameCreatedEvent = createGameEvent({
    creatorId: input.userId,
    featureFlags,
    type: 'CreateGame',
  });
  const result = await context.options.gameRepository.createGame({
    commandId: input.commandId,
    creatorUserId: input.userId,
    event: gameCreatedEvent,
    requestHash,
  });

  if (result.status === 'commandIdConflict') {
    return result;
  }

  if (result.status === 'duplicateCommand') {
    return loadDuplicateCreatedGame(result.gameId, input.userId);
  }

  const state = applyEvent(null, gameCreatedEvent);
  context.options.activeGames.store(result.gameId, state);
  context.emptyWaitingGameExpiration.schedule({
    expiresAt: context.emptyWaitingGameExpiration.createExpiresAt(
      result.createdAt
    ),
    gameId: result.gameId,
    retryAttempt: 0,
  });
  context.gameUpdatePublisher.notify({
    gameId: result.gameId,
    previousVersion: 0,
  });

  return {
    gameId: result.gameId,
    status: 'created',
    view: createViewFor(state, { role: 'spectator' }),
  };

  async function loadDuplicateCreatedGame(
    gameId: string,
    userId: string
  ): Promise<DuplicateCreateGameResult> {
    const loadedGame = await context.gameLoader.load(gameId);

    if (loadedGame === null) {
      throw new Error(`Created game ${gameId} does not exist.`);
    }

    const viewer = await context.gameLoader.resolveViewer({
      gameId,
      state: loadedGame.state,
      userId,
    });

    return {
      gameId,
      status: 'duplicateCommand',
      view: createViewFor(loadedGame.state, viewer),
    };
  }
}
