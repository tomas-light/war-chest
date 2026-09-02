import {
  type Viewer,
  applyEvent,
  createViewEventFor,
  createViewFor,
  decide,
} from '@war-chest/game-engine';
import { checkCommandAccess } from './checkCommandAccess.js';
import { checkJoinGamePreconditions } from './checkJoinGamePreconditions.js';
import { createProjectionChanges } from './createProjectionChanges.js';
import { createRequestHash } from './createRequestHash.js';
import type { GameServiceContext } from './GameServiceContext.js';
import type {
  ExecuteGameCommandInput,
  ExecuteGameCommandResult,
  SavedCommandResult,
} from './GameServiceTypes.js';
import { getCurrentDate } from './getCurrentDate.js';
import { getPlayerViewer } from './getPlayerViewer.js';

interface DeleteCreatorWaitingGameInput {
  expectedVersion: number;
  gameId: string;
  previousVersion: number;
}

export function executeCommand(
  context: GameServiceContext,
  input: ExecuteGameCommandInput
): Promise<ExecuteGameCommandResult> {
  return context.options.activeGames.runExclusive(
    input.gameId,
    executeGameCommand
  );

  async function executeGameCommand(): Promise<ExecuteGameCommandResult> {
    const requestHash = createRequestHash({
      command: input.command,
      expectedVersion: input.expectedVersion,
      gameId: input.gameId,
      userId: input.userId,
    });
    const existingCommand =
      await context.options.gameRepository.findProcessedCommand(
        input.commandId
      );

    if (existingCommand !== null) {
      const isExactDuplicate =
        existingCommand.gameId === input.gameId &&
        existingCommand.userId === input.userId &&
        existingCommand.commandType === input.command.type &&
        existingCommand.requestHash === requestHash;

      if (!isExactDuplicate) {
        return { status: 'commandIdConflict' };
      }

      return createDuplicateCommandResult();
    }

    const activeGame = await context.gameLoader.load(input.gameId);

    if (activeGame === null) {
      return { status: 'gameNotFound' };
    }

    if (input.expectedVersion !== activeGame.state.lastEventSequence) {
      return {
        currentVersion: activeGame.state.lastEventSequence,
        status: 'versionConflict',
      };
    }

    const participant = await context.options.gameRepository.findParticipant(
      input.gameId,
      input.userId
    );
    const commandAccessResult = checkCommandAccess({
      command: input.command,
      participant,
      state: activeGame.state,
      userId: input.userId,
    });

    if (commandAccessResult !== null) {
      return commandAccessResult;
    }

    if (
      input.command.type === 'LeaveGame' &&
      activeGame.state.creatorId === input.userId
    ) {
      return deleteCreatorWaitingGame({
        expectedVersion: input.expectedVersion,
        gameId: input.gameId,
        previousVersion: activeGame.state.lastEventSequence,
      });
    }

    if (input.command.type === 'JoinGame') {
      const currentPlayerGameId =
        await context.options.gameRepository.findCurrentPlayerGame(
          input.userId
        );

      if (
        currentPlayerGameId !== null &&
        currentPlayerGameId !== input.gameId
      ) {
        return { gameId: currentPlayerGameId, status: 'playerAlreadyInGame' };
      }

      const joinGamePreconditionResult = checkJoinGamePreconditions({
        command: input.command,
        participant,
        state: activeGame.state,
        userId: input.userId,
      });

      if (joinGamePreconditionResult !== null) {
        return joinGamePreconditionResult;
      }
    }

    const events = decide(activeGame.state, input.userId, input.command);

    if (events.length === 0) {
      return { status: 'commandRejected' };
    }

    const previousVersion = activeGame.state.lastEventSequence;
    const projectionChanges = createProjectionChanges(events, getCurrentDate());
    const saveResult = await context.options.gameRepository.saveCommand({
      commandId: input.commandId,
      commandType: input.command.type,
      events,
      expectedVersion: input.expectedVersion,
      gameChanges: projectionChanges.gameChanges,
      gameId: input.gameId,
      participantChanges: projectionChanges.participantChanges,
      requestHash,
      userId: input.userId,
    });

    if (saveResult.status === 'commandIdConflict') {
      return saveResult;
    }

    if (saveResult.status === 'playerAlreadyInGame') {
      const currentPlayerGameId =
        await context.options.gameRepository.findCurrentPlayerGame(
          input.userId
        );

      return {
        gameId: currentPlayerGameId ?? input.gameId,
        status: 'playerAlreadyInGame',
      };
    }

    if (saveResult.status === 'versionConflict') {
      await context.gameLoader.reload(input.gameId);
      return saveResult;
    }

    if (saveResult.status === 'duplicateCommand') {
      const duplicateResult = await createDuplicateCommandResult();

      if (duplicateResult.status === 'gameNotFound') {
        throw new Error(`Stored game ${input.gameId} does not exist.`);
      }

      return duplicateResult;
    }

    const nextState = events.reduce(applyEvent, activeGame.state);
    activeGame.state = nextState;
    context.emptyWaitingGameExpiration.updateAfterCommand(
      input.gameId,
      nextState
    );

    const viewer: Viewer =
      input.command.type === 'JoinGame' || participant !== null
        ? getPlayerViewer(input.userId)
        : { role: 'spectator' };
    const result: SavedCommandResult = {
      currentVersion: nextState.lastEventSequence,
      events: events.map((event) => createViewEventFor(event, viewer)),
      previousVersion,
      status: 'saved',
      view: createViewFor(nextState, viewer),
    };

    if (nextState.status === 'finished') {
      context.options.activeGames.delete(input.gameId);
    }

    context.gameUpdatePublisher.notify({
      gameId: input.gameId,
      previousVersion,
    });

    return result;
  }

  async function createDuplicateCommandResult(): Promise<
    Extract<
      ExecuteGameCommandResult,
      { status: 'duplicateCommand' | 'gameNotFound' }
    >
  > {
    const loadedGame = await context.gameLoader.reload(input.gameId);

    if (loadedGame === null) {
      return { status: 'gameNotFound' };
    }

    const viewer = await context.gameLoader.resolveViewer({
      gameId: input.gameId,
      state: loadedGame.state,
      userId: input.userId,
    });

    return {
      currentVersion: loadedGame.state.lastEventSequence,
      status: 'duplicateCommand',
      synchronization: await context.gameSynchronization.create({
        afterSequence: input.expectedVersion,
        gameId: input.gameId,
        state: loadedGame.state,
        viewer,
      }),
    };
  }

  async function deleteCreatorWaitingGame(
    deleteInput: DeleteCreatorWaitingGameInput
  ): Promise<ExecuteGameCommandResult> {
    const result = await context.options.gameRepository.deleteWaitingGame({
      expectedVersion: deleteInput.expectedVersion,
      gameId: deleteInput.gameId,
    });

    if (result.status === 'versionConflict') {
      await context.gameLoader.reload(deleteInput.gameId);
      return result;
    }

    if (result.status === 'notFound') {
      context.emptyWaitingGameExpiration.clear(deleteInput.gameId);
      context.options.activeGames.delete(deleteInput.gameId);
      return { status: 'gameNotFound' };
    }

    if (result.status === 'notWaiting') {
      return { status: 'commandRejected' };
    }

    context.emptyWaitingGameExpiration.clear(deleteInput.gameId);
    context.options.activeGames.delete(deleteInput.gameId);
    context.gameUpdatePublisher.notify({
      gameId: deleteInput.gameId,
      previousVersion: deleteInput.previousVersion,
    });

    return { status: 'gameDeleted' };
  }
}
