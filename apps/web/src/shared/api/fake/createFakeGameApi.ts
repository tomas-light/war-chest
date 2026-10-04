import type {
  CancelTurnDraftRequest,
  CompleteCardSelectionRequest,
  ConfirmCardChoiceRequest,
  ConfirmTurnDraftRequest,
  CreateGameRequest,
  GameEventsResponse,
  GameResponse,
  GameTurnDraftResponse,
  GameTurnHistoryQuery,
  GameTurnHistoryResponse,
  JoinGameRequest,
  LeaveGameRequest,
  LeaveGameResponse,
  LobbyGame,
  LobbyGamePlayer,
  LobbyGamesResponse,
  PassTurnRequest,
  SaveTurnDraftRequest,
  StartGameRequest,
  SurrenderGameRequest,
  SwapPlayerPositionsRequest,
  UpdateGameSettingsRequest,
} from '@war-chest/api-contracts';
import { saveTurnDraftRequestSchema } from '@war-chest/api-contracts';
import type {
  FakeGame,
  FakeGameEvent,
  FakeGameParticipant,
  FakeProcessedCommand,
} from '@war-chest/fake-database';
import {
  type GameCommandData,
  type GameEventData,
  type GameState,
  type Viewer,
  applyEvent,
  createDefaultGameSettings,
  createGame as createGameEvent,
  createViewEventFor,
  createViewFor,
  decide,
  parseGameEventData,
  previewTurnAction,
  restoreGame,
} from '@war-chest/game-engine';
import { type ApiClientErrorCode, ApiClientError } from '../ApiClientError';
import type { GameApi } from '../GameApi';
import { createFakePublicUser } from './createFakePublicUser';
import { getFakeDatabase } from './getFakeDatabase';

interface ExecuteCommandInput {
  command: GameCommandData;
  commandId: string;
  expectedVersion: number;
  gameId: string;
}

interface CreateStoredEventInput {
  commandId: string;
  createdAt: Date;
  event: GameEventData;
  gameId: string;
}

export function createFakeGameApi(userId: string): GameApi {
  return {
    cancelTurnDraft,
    completeCardSelection,
    confirmCardChoice,
    confirmTurnDraft,
    createGame,
    getGame,
    getGameEvents,
    getTurnDraft,
    joinGame,
    leaveGame,
    listLobbyGames,
    listTurnHistory,
    passTurn,
    saveTurnDraft,
    startGame,
    surrenderGame,
    swapPlayerPositions,
    updateGameSettings,
  };

  async function getTurnDraft(gameId: string): Promise<GameTurnDraftResponse> {
    const game = await getGame(gameId);

    if (game.view.currentPlayerId !== userId) {
      return { draft: null };
    }

    const database = await getFakeDatabase();
    const storedDraft = await database.gameTurnDraft.get(gameId);

    if (
      storedDraft === undefined ||
      storedDraft.playerId !== userId ||
      storedDraft.baseVersion !== game.view.lastEventSequence
    ) {
      return { draft: null };
    }

    const parsed = saveTurnDraftRequestSchema.safeParse({
      action: storedDraft.action,
      coinIndex: storedDraft.coinIndex,
      expectedVersion: storedDraft.baseVersion,
    });

    if (!parsed.success) {
      return { draft: null };
    }

    const projectedBattlefield = previewTurnAction({
      action: parsed.data.action,
      coinIndex: storedDraft.coinIndex,
      playerId: userId,
      view: game.view,
    });

    if (projectedBattlefield === null) {
      return { draft: null };
    }

    return {
      draft: {
        action: parsed.data.action,
        baseVersion: storedDraft.baseVersion,
        coinIndex: storedDraft.coinIndex,
        id: storedDraft.id,
        projectedBattlefield,
        revision: storedDraft.revision,
      },
    };
  }

  async function saveTurnDraft(
    gameId: string,
    request: SaveTurnDraftRequest
  ): Promise<GameTurnDraftResponse> {
    const game = await getGame(gameId);
    const projectedBattlefield = previewTurnAction({
      action: request.action,
      coinIndex: request.coinIndex,
      playerId: userId,
      view: game.view,
    });

    if (
      game.view.lastEventSequence !== request.expectedVersion ||
      projectedBattlefield === null
    ) {
      throw createFakeApiError(
        'game_version_conflict',
        'The turn draft is no longer current.'
      );
    }

    const database = await getFakeDatabase();
    const previousDraft = await database.gameTurnDraft.get(gameId);
    const reusableDraft =
      previousDraft?.playerId === userId &&
      previousDraft.baseVersion === request.expectedVersion
        ? previousDraft
        : undefined;
    const id = reusableDraft?.id ?? crypto.randomUUID();
    const revision = (reusableDraft?.revision ?? 0) + 1;
    const storedDraft = {
      action: request.action,
      baseVersion: request.expectedVersion,
      coinIndex: request.coinIndex,
      gameId,
      id,
      playerId: userId,
      revision,
    };

    if (previousDraft === undefined) {
      await database.gameTurnDraft.insert(gameId, storedDraft);
    } else {
      await database.gameTurnDraft.update(gameId, storedDraft);
    }

    return {
      draft: {
        action: request.action,
        baseVersion: request.expectedVersion,
        coinIndex: request.coinIndex,
        id,
        projectedBattlefield,
        revision,
      },
    };
  }

  async function cancelTurnDraft(
    gameId: string,
    request: CancelTurnDraftRequest
  ): Promise<GameTurnDraftResponse> {
    const database = await getFakeDatabase();
    const storedDraft = await database.gameTurnDraft.get(gameId);

    if (
      storedDraft === undefined ||
      storedDraft.playerId !== userId ||
      storedDraft.id !== request.draftId ||
      storedDraft.revision !== request.revision
    ) {
      throw createFakeApiError(
        'game_version_conflict',
        'The turn draft is no longer current.'
      );
    }

    await database.gameTurnDraft.delete(gameId);
    return { draft: null };
  }

  async function confirmTurnDraft(
    gameId: string,
    request: ConfirmTurnDraftRequest
  ): Promise<GameResponse> {
    const database = await getFakeDatabase();
    const storedDraft = await database.gameTurnDraft.get(gameId);

    if (
      storedDraft === undefined ||
      storedDraft.playerId !== userId ||
      storedDraft.id !== request.draftId ||
      storedDraft.revision !== request.revision ||
      storedDraft.baseVersion !== request.expectedVersion
    ) {
      throw createFakeApiError(
        'game_version_conflict',
        'The turn draft is no longer current.'
      );
    }

    const parsed = saveTurnDraftRequestSchema.safeParse({
      action: storedDraft.action,
      coinIndex: storedDraft.coinIndex,
      expectedVersion: storedDraft.baseVersion,
    });

    if (!parsed.success) {
      throw createFakeApiError(
        'invalid_response',
        'Stored turn draft is invalid.'
      );
    }

    const game = await executeCommand({
      command: {
        action: parsed.data.action,
        coinIndex: storedDraft.coinIndex,
        type: 'PerformTurnAction',
      },
      commandId: request.commandId,
      expectedVersion: request.expectedVersion,
      gameId,
    });

    await database.gameTurnDraft.delete(gameId);
    return game;
  }

  function completeCardSelection(
    gameId: string,
    request: CompleteCardSelectionRequest
  ): Promise<GameResponse> {
    return executeCommand({
      command: { type: 'CompleteCardSelection' },
      commandId: request.commandId,
      expectedVersion: request.expectedVersion,
      gameId,
    });
  }

  function confirmCardChoice(
    gameId: string,
    request: ConfirmCardChoiceRequest
  ): Promise<GameResponse> {
    return executeCommand({
      command: { type: 'ConfirmCardChoice', unitId: request.unitId },
      commandId: request.commandId,
      expectedVersion: request.expectedVersion,
      gameId,
    });
  }

  async function createGame(request: CreateGameRequest): Promise<GameResponse> {
    const database = await getFakeDatabase();
    const requestHash = await createRequestHash({
      format: request.format,
      operation: 'CreateGame',
      userId,
    });
    const existingCommand = await database.games.findProcessedCommand(
      request.commandId
    );

    if (existingCommand !== null) {
      if (
        existingCommand.commandType !== 'CreateGame' ||
        existingCommand.requestHash !== requestHash ||
        existingCommand.userId !== userId
      ) {
        throw createFakeApiError(
          'command_id_conflict',
          'Command id was already used by another request.'
        );
      }

      return getGame(existingCommand.gameId);
    }

    const currentPlayerGame =
      await database.games.findCurrentPlayerGame(userId);

    if (currentPlayerGame !== null) {
      throw createFakeApiError(
        'player_already_in_game',
        'The user is already playing another game.'
      );
    }

    const featureFlags = await database.featureFlags.getApplication();

    const gameCreatedEvent = createGameEvent({
      creatorId: userId,
      featureFlags,
      settings: createDefaultGameSettings(request.format),
      type: 'CreateGame',
    });
    const createdAt = new Date();
    const gameId = crypto.randomUUID();
    const state = applyEvent(null, gameCreatedEvent);
    const processedCommand: FakeProcessedCommand = {
      commandType: 'CreateGame',
      gameId,
      id: request.commandId,
      processedAt: createdAt,
      requestHash,
      userId,
    };
    const game: FakeGame = {
      cardSelectionMode: state.settings.cardSelectionMode,
      createdAt,
      currentVersion: state.lastEventSequence,
      expansions: [...state.settings.expansions],
      finishedAt: null,
      format: state.settings.format,
      id: gameId,
      startedAt: null,
      status: 'waiting',
      winnerTeam: null,
    };

    await database.games.saveChanges({
      events: [
        createStoredEvent({
          commandId: request.commandId,
          createdAt,
          event: gameCreatedEvent,
          gameId,
        }),
      ],
      game,
      processedCommand,
    });

    return {
      gameId,
      players: [],
      view: createViewFor(state, { role: 'spectator' }),
    };
  }

  async function getGame(gameId: string): Promise<GameResponse> {
    const database = await getFakeDatabase();
    const game = await database.games.getById(gameId);

    if (game === null) {
      throw createFakeApiError('game_not_found', 'Game was not found.');
    }

    const state = await loadGameState(gameId);
    const participant = await database.games.getParticipant(gameId, userId);
    const viewer: Viewer =
      participant === null ? { role: 'spectator' } : getPlayerViewer(userId);

    return {
      gameId,
      players: await getGamePlayers(gameId),
      view: createViewFor(state, viewer),
    };
  }

  function joinGame(
    gameId: string,
    request: JoinGameRequest
  ): Promise<GameResponse> {
    return executeCommand({
      command: { seat: request.seat, team: request.team, type: 'JoinGame' },
      commandId: request.commandId,
      expectedVersion: request.expectedVersion,
      gameId,
    });
  }

  async function listLobbyGames(): Promise<LobbyGamesResponse> {
    const database = await getFakeDatabase();
    const games = (await database.game.getAll())
      .filter((game) => game.status !== 'finished')
      .sort(
        (firstGame, secondGame) =>
          secondGame.createdAt.getTime() - firstGame.createdAt.getTime()
      );
    const items = await Promise.all(games.map(createLobbyGame));

    const currentPlayerGame =
      await database.games.findCurrentPlayerGame(userId);

    return {
      currentPlayerGameId: currentPlayerGame?.id ?? null,
      items,
    };

    async function createLobbyGame(game: FakeGame): Promise<LobbyGame> {
      const players = await getGamePlayers(game.id);

      return {
        createdAt: game.createdAt.toISOString(),
        id: game.id,
        players,
        settings: {
          cardSelectionMode: game.cardSelectionMode,
          expansions: [...game.expansions],
          format: game.format,
        },
        startedAt: game.startedAt?.toISOString() ?? null,
        status: game.status === 'active' ? 'active' : 'waiting',
      };
    }
  }

  async function listTurnHistory(
    gameId: string,
    query: GameTurnHistoryQuery
  ): Promise<GameTurnHistoryResponse> {
    const database = await getFakeDatabase();
    const game = await database.games.getById(gameId);

    if (game === null) {
      throw createFakeApiError('game_not_found', 'Game was not found.');
    }

    const storedEvents = await database.games.getEvents(gameId);
    const history = storedEvents.flatMap((storedEvent) => {
      const event = parseGameEventData({
        payload: storedEvent.payload,
        sequence: storedEvent.sequence,
        type: storedEvent.type,
        version: storedEvent.version,
      });

      if (
        (event.type !== 'TurnPassed' && event.type !== 'TurnActionPerformed') ||
        (query.beforeSequence !== undefined &&
          event.sequence >= query.beforeSequence)
      ) {
        return [];
      }

      return [event];
    });
    history.reverse();
    const hasNextPage = history.length > query.limit;
    const page = history.slice(0, query.limit);
    const lastItem = page.at(-1);

    return {
      items: page.map((event) => ({
        action:
          event.type === 'TurnPassed' ? 'pass' : event.payload.action.type,
        playerId: event.payload.playerId,
        sequence: event.sequence,
      })),
      nextCursor:
        hasNextPage && lastItem !== undefined ? lastItem.sequence : null,
    };
  }

  async function getGameEvents(gameId: string): Promise<GameEventsResponse> {
    await getGame(gameId);

    const database = await getFakeDatabase();
    const participant = await database.games.getParticipant(gameId, userId);
    const viewer: Viewer =
      participant === null ? { role: 'spectator' } : getPlayerViewer(userId);
    const storedEvents = await database.games.getEvents(gameId);

    return {
      events: storedEvents.map((event) =>
        createViewEventFor(
          parseGameEventData({
            payload: event.payload,
            sequence: event.sequence,
            type: event.type,
            version: event.version,
          }),
          viewer
        )
      ),
      gameId,
    };
  }

  function passTurn(
    gameId: string,
    request: PassTurnRequest
  ): Promise<GameResponse> {
    return executeCommand({
      command: { coinIndex: request.coinIndex, type: 'PassTurn' },
      commandId: request.commandId,
      expectedVersion: request.expectedVersion,
      gameId,
    });
  }

  async function leaveGame(
    gameId: string,
    request: LeaveGameRequest
  ): Promise<LeaveGameResponse> {
    const database = await getFakeDatabase();
    const command = { type: 'LeaveGame' } as const;
    const requestHash = await createRequestHash({
      command,
      expectedVersion: request.expectedVersion,
      gameId,
      userId,
    });
    const existingCommand = await database.games.findProcessedCommand(
      request.commandId
    );

    if (existingCommand !== null) {
      const isExactDuplicate =
        existingCommand.commandType === command.type &&
        existingCommand.gameId === gameId &&
        existingCommand.requestHash === requestHash &&
        existingCommand.userId === userId;

      if (!isExactDuplicate) {
        throw createFakeApiError(
          'command_id_conflict',
          'Command id was already used by another request.'
        );
      }

      return { gameId };
    }

    const game = await database.games.getById(gameId);

    if (game === null) {
      throw createFakeApiError('game_not_found', 'Game was not found.');
    }

    const state = await loadGameState(gameId);

    if (state.creatorId !== userId) {
      await executeCommand({
        command,
        commandId: request.commandId,
        expectedVersion: request.expectedVersion,
        gameId,
      });
      return { gameId };
    }

    const deletionResult = await database.games.deleteWaitingGame(
      gameId,
      request.expectedVersion
    );

    if (deletionResult.status === 'versionConflict') {
      throw createFakeApiError(
        'game_version_conflict',
        'The game has changed since the requested version.'
      );
    }

    if (deletionResult.status === 'notFound') {
      throw createFakeApiError('game_not_found', 'Game was not found.');
    }

    if (deletionResult.status === 'notWaiting') {
      throw createFakeApiError(
        'game_command_rejected',
        'Only a waiting game can be closed.'
      );
    }

    return { gameId };
  }

  function startGame(
    gameId: string,
    request: StartGameRequest
  ): Promise<GameResponse> {
    return executeCommand({
      command: { type: 'StartGame' },
      commandId: request.commandId,
      expectedVersion: request.expectedVersion,
      gameId,
    });
  }

  function swapPlayerPositions(
    gameId: string,
    request: SwapPlayerPositionsRequest
  ): Promise<GameResponse> {
    return executeCommand({
      command: { type: 'SwapPlayerPositions' },
      commandId: request.commandId,
      expectedVersion: request.expectedVersion,
      gameId,
    });
  }

  function surrenderGame(
    gameId: string,
    request: SurrenderGameRequest
  ): Promise<GameResponse> {
    return executeCommand({
      command: { type: 'SurrenderGame' },
      commandId: request.commandId,
      expectedVersion: request.expectedVersion,
      gameId,
    });
  }

  function updateGameSettings(
    gameId: string,
    request: UpdateGameSettingsRequest
  ): Promise<GameResponse> {
    return executeCommand({
      command: {
        cardSelectionMode: request.cardSelectionMode,
        expansions: request.expansions,
        type: 'UpdateGameSettings',
      },
      commandId: request.commandId,
      expectedVersion: request.expectedVersion,
      gameId,
    });
  }

  async function executeCommand(
    input: ExecuteCommandInput
  ): Promise<GameResponse> {
    const database = await getFakeDatabase();
    const existingCommand = await database.games.findProcessedCommand(
      input.commandId
    );
    const requestHash = await createRequestHash({
      command: input.command,
      expectedVersion: input.expectedVersion,
      gameId: input.gameId,
      userId,
    });

    if (existingCommand !== null) {
      if (
        existingCommand.commandType !== input.command.type ||
        existingCommand.gameId !== input.gameId ||
        existingCommand.requestHash !== requestHash ||
        existingCommand.userId !== userId
      ) {
        throw createFakeApiError(
          'command_id_conflict',
          'Command id was already used by another request.'
        );
      }

      return getGame(input.gameId);
    }

    const game = await database.games.getById(input.gameId);

    if (game === null) {
      throw createFakeApiError('game_not_found', 'Game was not found.');
    }

    const state = await loadGameState(input.gameId);

    if (state.lastEventSequence !== input.expectedVersion) {
      throw createFakeApiError(
        'game_version_conflict',
        'The game has changed since the requested version.'
      );
    }

    const participant = await database.games.getParticipant(
      input.gameId,
      userId
    );

    if (input.command.type === 'JoinGame' && participant === null) {
      const currentPlayerGame =
        await database.games.findCurrentPlayerGame(userId);

      if (currentPlayerGame !== null && currentPlayerGame.id !== input.gameId) {
        throw createFakeApiError(
          'player_already_in_game',
          'The user is already playing another game.'
        );
      }
    }

    if (
      (input.command.type === 'StartGame' ||
        input.command.type === 'UpdateGameSettings') &&
      state.creatorId !== userId
    ) {
      throw createFakeApiError(
        'game_command_forbidden',
        'Only the creator can perform this command.'
      );
    }

    if (
      input.command.type === 'SwapPlayerPositions' &&
      state.creatorId !== userId
    ) {
      throw createFakeApiError(
        'game_command_forbidden',
        'Only the creator can swap player positions.'
      );
    }

    if (
      input.command.type !== 'JoinGame' &&
      input.command.type !== 'StartGame' &&
      input.command.type !== 'SwapPlayerPositions' &&
      input.command.type !== 'UpdateGameSettings' &&
      participant === null
    ) {
      throw createFakeApiError(
        'game_command_forbidden',
        'A spectator cannot perform this command.'
      );
    }

    const events = decide(state, userId, input.command);

    if (events.length === 0) {
      throw createFakeApiError(
        'game_command_rejected',
        'The game command was rejected.'
      );
    }

    const occurredAt = new Date();
    const nextState = events.reduce(applyEvent, state);
    const nextGame: FakeGame = {
      ...game,
      cardSelectionMode: nextState.settings.cardSelectionMode,
      currentVersion: nextState.lastEventSequence,
      expansions: [...nextState.settings.expansions],
      finishedAt:
        nextState.status === 'finished' && game.finishedAt === null
          ? occurredAt
          : game.finishedAt,
      startedAt:
        events.some((event) => event.type === 'GameStarted') &&
        game.startedAt === null
          ? occurredAt
          : game.startedAt,
      status:
        nextState.status === 'cardSelection' ? 'active' : nextState.status,
      winnerTeam: nextState.winnerTeam,
    };
    const changedPlayer = events.find(
      (event) =>
        event.type === 'PlayerJoined' || event.type === 'PlayerPositionChanged'
    );
    const participants: readonly FakeGameParticipant[] =
      changedPlayer?.type === 'PlayerJoined' ||
      changedPlayer?.type === 'PlayerPositionChanged'
        ? [
            {
              gameId: input.gameId,
              seat: changedPlayer.payload.seat,
              team: changedPlayer.payload.team,
              userId: changedPlayer.payload.playerId,
            },
          ]
        : events.flatMap((event) => {
            if (event.type !== 'PlayerPositionsSwapped') {
              return [];
            }

            return event.payload.positions.map((position) => ({
              gameId: input.gameId,
              seat: position.seat,
              team: position.team,
              userId: position.playerId,
            }));
          });
    const processedCommand: FakeProcessedCommand = {
      commandType: input.command.type,
      gameId: input.gameId,
      id: input.commandId,
      processedAt: occurredAt,
      requestHash,
      userId,
    };

    await database.games.saveChanges({
      events: events.map((event) =>
        createStoredEvent({
          commandId: input.commandId,
          createdAt: occurredAt,
          event,
          gameId: input.gameId,
        })
      ),
      game: nextGame,
      participants,
      processedCommand,
      removedParticipantUserIds: events.flatMap((event) =>
        event.type === 'PlayerLeft' ? [event.payload.playerId] : []
      ),
    });

    const viewer: Viewer =
      input.command.type !== 'LeaveGame' &&
      (input.command.type === 'JoinGame' || participant !== null)
        ? getPlayerViewer(userId)
        : { role: 'spectator' };

    return {
      gameId: input.gameId,
      players: await getGamePlayers(input.gameId),
      view: createViewFor(nextState, viewer),
    };
  }

  async function getGamePlayers(
    gameId: string
  ): Promise<readonly LobbyGamePlayer[]> {
    const database = await getFakeDatabase();
    const participants = await database.games.listParticipants(gameId);

    return Promise.all(
      participants.map(async (participant) => {
        const user = await database.users.getById(participant.userId);

        if (user === null) {
          throw createFakeApiError(
            'invalid_response',
            `Participant ${participant.userId} was not found.`
          );
        }

        return {
          ...createFakePublicUser(user),
          seat: participant.seat,
          team: participant.team,
        };
      })
    );
  }

  async function loadGameState(gameId: string): Promise<GameState> {
    const database = await getFakeDatabase();
    const storedEvents = await database.games.getEvents(gameId);
    const state = restoreGame(
      storedEvents.map((event) =>
        parseGameEventData({
          payload: event.payload,
          sequence: event.sequence,
          type: event.type,
          version: event.version,
        })
      )
    );

    if (state === null) {
      throw createFakeApiError(
        'invalid_response',
        `Game ${gameId} does not contain events.`
      );
    }

    return state;
  }
}

function createStoredEvent(input: CreateStoredEventInput): FakeGameEvent {
  return {
    commandId: input.commandId,
    createdAt: input.createdAt,
    gameId: input.gameId,
    id: crypto.randomUUID(),
    payload: input.event.payload,
    sequence: input.event.sequence,
    type: input.event.type,
    version: input.event.version,
  };
}

function getPlayerViewer(playerId: string): Viewer {
  return { playerId, role: 'player' };
}

async function createRequestHash(value: unknown): Promise<string> {
  const encodedValue = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest('SHA-256', encodedValue);

  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

function createFakeApiError(
  code: ApiClientErrorCode,
  diagnosticMessage: string
): ApiClientError {
  return new ApiClientError({ code, diagnosticMessage });
}
