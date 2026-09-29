import 'fake-indexeddb/auto';
import {
  type ConfirmCardChoiceRequest,
  type GameResponse,
  gameResponseSchema,
  gameTurnDraftResponseSchema,
} from '@war-chest/api-contracts';
import {
  type FakeDatabase,
  createFakeDatabase,
  deleteFakeDatabase,
  FAKE_SEED_IDENTIFIERS,
} from '@war-chest/fake-database';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createFakeGameApi } from './createFakeGameApi';
import { getFakeDatabase } from './getFakeDatabase';

vi.mock('./getFakeDatabase', { spy: true });

const CREATE_COMMAND_ID = '30000000-0000-4000-8000-000000000001';
const FIRST_JOIN_COMMAND_ID = '30000000-0000-4000-8000-000000000002';
const SECOND_JOIN_COMMAND_ID = '30000000-0000-4000-8000-000000000003';
const MOVE_COMMAND_ID = '30000000-0000-4000-8000-000000000004';
const START_COMMAND_ID = '30000000-0000-4000-8000-000000000005';
const SWAP_COMMAND_ID = '30000000-0000-4000-8000-000000000006';
const SECOND_CREATE_COMMAND_ID = '30000000-0000-4000-8000-000000000007';
const THIRD_JOIN_COMMAND_ID = '30000000-0000-4000-8000-000000000008';
const LEAVE_COMMAND_ID = '30000000-0000-4000-8000-000000000009';
const SURRENDER_COMMAND_ID = '30000000-0000-4000-8000-000000000010';
const UPDATE_SETTINGS_COMMAND_ID = '30000000-0000-4000-8000-000000000011';
const CARD_CHOICE_COMMAND_ID = '30000000-0000-4000-8000-000000000012';
const PASS_COMMAND_ID = '30000000-0000-4000-8000-000000000013';
const CREATE_GAME_REQUEST = {
  commandId: CREATE_COMMAND_ID,
  format: 'duel',
} as const;
const SECOND_CREATE_GAME_REQUEST = {
  ...CREATE_GAME_REQUEST,
  commandId: SECOND_CREATE_COMMAND_ID,
};

describe('fake game API lifecycle', () => {
  let database: FakeDatabase;
  let databaseName: string;

  beforeEach(async () => {
    databaseName = `war-chest-game-api-${crypto.randomUUID()}`;
    database = await createFakeDatabase({ name: databaseName });
    vi.mocked(getFakeDatabase).mockResolvedValue(database);
  });

  afterEach(async () => {
    database.close();
    await deleteFakeDatabase({ name: databaseName });
    vi.restoreAllMocks();
  });

  test('creates a waiting game without occupying a position', async () => {
    const gameApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);

    const createdGame = await gameApi.createGame(CREATE_GAME_REQUEST);

    expect(gameResponseSchema.safeParse(createdGame).success).toBe(true);
    expect(createdGame.view).toMatchObject({
      lastEventSequence: 1,
      players: [],
      status: 'waiting',
    });
  });

  test('persists preparation settings changed by the creator', async () => {
    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const spectatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.secondUser);
    const createdGame = await creatorApi.createGame(CREATE_GAME_REQUEST);

    await creatorApi.updateGameSettings(createdGame.gameId, {
      cardSelectionMode: 'draft',
      commandId: UPDATE_SETTINGS_COMMAND_ID,
      expansions: [],
      expectedVersion: createdGame.view.lastEventSequence,
    });

    await expect(
      spectatorApi.getGame(createdGame.gameId)
    ).resolves.toMatchObject({
      view: {
        lastEventSequence: 2,
        settings: {
          cardSelectionMode: 'draft',
          expansions: [],
          format: 'duel',
        },
      },
    });
  });

  test('rejects preparation settings changed by a non-creator', async () => {
    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const spectatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.secondUser);
    const createdGame = await creatorApi.createGame(CREATE_GAME_REQUEST);

    await expect(
      spectatorApi.updateGameSettings(createdGame.gameId, {
        cardSelectionMode: 'draft',
        commandId: UPDATE_SETTINGS_COMMAND_ID,
        expansions: [],
        expectedVersion: createdGame.view.lastEventSequence,
      })
    ).rejects.toMatchObject({ code: 'game_command_forbidden' });
  });

  test('lets a second user join the free team position', async () => {
    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const secondPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.secondUser);
    const createdGame = await creatorApi.createGame(CREATE_GAME_REQUEST);

    const joinedGame = await secondPlayerApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'black',
    });

    expect(joinedGame.view).toMatchObject({
      lastEventSequence: 2,
      players: [{ id: FAKE_SEED_IDENTIFIERS.secondUser, team: 'black' }],
      status: 'waiting',
    });
  });

  test('lets a joined player move to the remaining free position', async () => {
    const gameApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const createdGame = await gameApi.createGame(CREATE_GAME_REQUEST);
    const joinedGame = await gameApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });

    const movedGame = await gameApi.joinGame(createdGame.gameId, {
      commandId: MOVE_COMMAND_ID,
      expectedVersion: joinedGame.view.lastEventSequence,
      seat: 1,
      team: 'black',
    });

    expect(movedGame.view).toMatchObject({
      lastEventSequence: 3,
      players: [{ id: FAKE_SEED_IDENTIFIERS.firstUser, team: 'black' }],
      teams: { black: [FAKE_SEED_IDENTIFIERS.firstUser], white: [] },
    });
  });

  test('lets the creator start without occupying a position', async () => {
    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const firstPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.secondUser);
    const secondPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.thirdUser);
    const createdGame = await creatorApi.createGame(CREATE_GAME_REQUEST);
    const firstPlayerJoinedGame = await firstPlayerApi.joinGame(
      createdGame.gameId,
      {
        commandId: FIRST_JOIN_COMMAND_ID,
        expectedVersion: createdGame.view.lastEventSequence,
        seat: 1,
        team: 'white',
      }
    );
    const secondPlayerJoinedGame = await secondPlayerApi.joinGame(
      createdGame.gameId,
      {
        commandId: SECOND_JOIN_COMMAND_ID,
        expectedVersion: firstPlayerJoinedGame.view.lastEventSequence,
        seat: 1,
        team: 'black',
      }
    );

    const startedGame = await creatorApi.startGame(createdGame.gameId, {
      commandId: START_COMMAND_ID,
      expectedVersion: secondPlayerJoinedGame.view.lastEventSequence,
    });

    expect(startedGame.view).toMatchObject({
      creatorId: FAKE_SEED_IDENTIFIERS.firstUser,
      lastEventSequence: 6,
      privateMoves: [],
      status: 'active',
    });
  });

  test('persists a private face-down pass discard', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const firstPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const secondPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.secondUser);
    let game = await firstPlayerApi.createGame(CREATE_GAME_REQUEST);

    game = await firstPlayerApi.joinGame(game.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: game.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });
    game = await secondPlayerApi.joinGame(game.gameId, {
      commandId: SECOND_JOIN_COMMAND_ID,
      expectedVersion: game.view.lastEventSequence,
      seat: 1,
      team: 'black',
    });
    game = await firstPlayerApi.startGame(game.gameId, {
      commandId: START_COMMAND_ID,
      expectedVersion: game.view.lastEventSequence,
    });

    const isFirstPlayerTurn =
      game.view.currentPlayerId === FAKE_SEED_IDENTIFIERS.firstUser;
    const currentPlayerApi = isFirstPlayerTurn
      ? firstPlayerApi
      : secondPlayerApi;
    const opponentApi = isFirstPlayerTurn ? secondPlayerApi : firstPlayerApi;
    const currentGame = await currentPlayerApi.getGame(game.gameId);
    const currentResources = currentGame.view.battlefield?.playerResources.find(
      (resources) => resources.playerId === currentGame.view.currentPlayerId
    );
    const selectedCoin = currentResources?.hand?.[0];

    if (selectedCoin === undefined) {
      throw new Error('The current player must have a coin to pass.');
    }

    const passedGame = await currentPlayerApi.passTurn(game.gameId, {
      coinIndex: 0,
      commandId: PASS_COMMAND_ID,
      expectedVersion: currentGame.view.lastEventSequence,
    });
    const opponentGame = await opponentApi.getGame(game.gameId);
    const playerId = currentGame.view.currentPlayerId;
    const privateDiscard = passedGame.view.battlefield?.playerResources.find(
      (resources) => resources.playerId === playerId
    )?.discard;
    const publicDiscard = opponentGame.view.battlefield?.playerResources.find(
      (resources) => resources.playerId === playerId
    )?.discard;

    expect(privateDiscard).toEqual([{ coin: selectedCoin, faceUp: false }]);
    expect(publicDiscard).toEqual([{ coin: null, faceUp: false }]);
  });

  test('persists a private recruit draft and commits one revealed supply coin', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const firstPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const secondPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.secondUser);
    let game = await firstPlayerApi.createGame(CREATE_GAME_REQUEST);

    game = await firstPlayerApi.joinGame(game.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: game.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });
    game = await secondPlayerApi.joinGame(game.gameId, {
      commandId: SECOND_JOIN_COMMAND_ID,
      expectedVersion: game.view.lastEventSequence,
      seat: 1,
      team: 'black',
    });
    game = await firstPlayerApi.startGame(game.gameId, {
      commandId: START_COMMAND_ID,
      expectedVersion: game.view.lastEventSequence,
    });

    const currentPlayerId = game.view.currentPlayerId;
    const currentPlayerApi =
      currentPlayerId === FAKE_SEED_IDENTIFIERS.firstUser
        ? firstPlayerApi
        : secondPlayerApi;
    const opponentApi =
      currentPlayerId === FAKE_SEED_IDENTIFIERS.firstUser
        ? secondPlayerApi
        : firstPlayerApi;
    const currentGame = await currentPlayerApi.getGame(game.gameId);
    const resources = currentGame.view.battlefield?.playerResources.find(
      (item) => item.playerId === currentPlayerId
    );
    const recruitTarget = resources?.supply.find(
      (item) =>
        item.count > 0 &&
        ['cavalry', 'crossbowman', 'lightCavalry', 'swordsman'].includes(
          item.unitId
        )
    );

    if (resources?.hand?.[0] === undefined || recruitTarget === undefined) {
      throw new Error(
        'The current player needs a coin and a supported supply unit.'
      );
    }

    const draftResponse = await currentPlayerApi.saveTurnDraft(game.gameId, {
      action: { type: 'recruit', unitId: recruitTarget.unitId },
      coinIndex: 0,
      expectedVersion: currentGame.view.lastEventSequence,
    });
    const draft = draftResponse.draft;

    if (draft === null) {
      throw new Error('Recruitment must produce a draft.');
    }

    expect(gameTurnDraftResponseSchema.safeParse(draftResponse).success).toBe(
      true
    );
    expect(
      (await currentPlayerApi.getGame(game.gameId)).view.lastEventSequence
    ).toBe(currentGame.view.lastEventSequence);
    expect(
      (await createFakeGameApi(currentPlayerId ?? '').getTurnDraft(game.gameId))
        .draft?.id
    ).toBe(draft.id);
    expect((await opponentApi.getTurnDraft(game.gameId)).draft).toBeNull();

    const confirmedGame = await currentPlayerApi.confirmTurnDraft(game.gameId, {
      commandId: MOVE_COMMAND_ID,
      draftId: draft.id,
      expectedVersion: draft.baseVersion,
      revision: draft.revision,
    });
    const opponentGame = await opponentApi.getGame(game.gameId);
    const opponentDiscard = opponentGame.view.battlefield?.playerResources.find(
      (item) => item.playerId === currentPlayerId
    )?.discard;

    expect(confirmedGame.view.lastEventSequence).toBe(
      currentGame.view.lastEventSequence + 1
    );
    expect(opponentDiscard).toEqual([
      { coin: null, faceUp: false },
      { coin: { kind: 'unit', unitId: recruitTarget.unitId }, faceUp: true },
    ]);
    expect((await currentPlayerApi.getTurnDraft(game.gameId)).draft).toBeNull();
    expect(
      (await currentPlayerApi.listTurnHistory(game.gameId, { limit: 10 }))
        .items[0]?.action
    ).toBe('recruit');
  });

  test('persists a confirmed card choice from the current player', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);

    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const secondPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.secondUser);

    const createdGame = await creatorApi.createGame(CREATE_GAME_REQUEST);
    const creatorJoinedGame = await creatorApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });
    const secondPlayerJoinedGame = await secondPlayerApi.joinGame(
      createdGame.gameId,
      {
        commandId: SECOND_JOIN_COMMAND_ID,
        expectedVersion: creatorJoinedGame.view.lastEventSequence,
        seat: 1,
        team: 'black',
      }
    );
    const configuredGame = await creatorApi.updateGameSettings(
      createdGame.gameId,
      {
        cardSelectionMode: 'draft',
        commandId: UPDATE_SETTINGS_COMMAND_ID,
        expansions: [],
        expectedVersion: secondPlayerJoinedGame.view.lastEventSequence,
      }
    );
    const startedGame = await creatorApi.startGame(createdGame.gameId, {
      commandId: START_COMMAND_ID,
      expectedVersion: configuredGame.view.lastEventSequence,
    });

    const [unitId] = startedGame.view.cardSelection?.pool ?? [];

    if (unitId === undefined) {
      throw new Error('Draft must expose a card pool.');
    }

    const confirmedGame = await creatorApi.confirmCardChoice(
      createdGame.gameId,
      {
        commandId: CARD_CHOICE_COMMAND_ID,
        expectedVersion: startedGame.view.lastEventSequence,
        unitId,
      }
    );

    expect(confirmedGame.view).toMatchObject({
      cardSelection: {
        choices: [
          {
            action: 'pick',
            playerId: FAKE_SEED_IDENTIFIERS.firstUser,
            unitId,
          },
        ],
      },
      currentPlayerId: FAKE_SEED_IDENTIFIERS.secondUser,
      lastEventSequence: 7,
    });
  });

  test('rejects start from a joined player who is not the creator', async () => {
    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const secondPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.secondUser);
    const createdGame = await creatorApi.createGame(CREATE_GAME_REQUEST);
    const creatorJoinedGame = await creatorApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });
    const secondPlayerJoinedGame = await secondPlayerApi.joinGame(
      createdGame.gameId,
      {
        commandId: SECOND_JOIN_COMMAND_ID,
        expectedVersion: creatorJoinedGame.view.lastEventSequence,
        seat: 1,
        team: 'black',
      }
    );
    await expect(
      secondPlayerApi.startGame(createdGame.gameId, {
        commandId: START_COMMAND_ID,
        expectedVersion: secondPlayerJoinedGame.view.lastEventSequence,
      })
    ).rejects.toMatchObject({ code: 'game_command_forbidden' });
  });

  describe('automatic draft completion', () => {
    let pendingGame: GameResponse;
    let confirmedGame: GameResponse;
    let request: ConfirmCardChoiceRequest;

    beforeEach(async () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.999);

      const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
      const secondPlayerApi = createFakeGameApi(
        FAKE_SEED_IDENTIFIERS.secondUser
      );

      let game = await creatorApi.createGame(CREATE_GAME_REQUEST);

      game = await creatorApi.updateGameSettings(game.gameId, {
        cardSelectionMode: 'draft',
        commandId: UPDATE_SETTINGS_COMMAND_ID,
        expansions: [],
        expectedVersion: game.view.lastEventSequence,
      });
      game = await creatorApi.joinGame(game.gameId, {
        commandId: FIRST_JOIN_COMMAND_ID,
        expectedVersion: game.view.lastEventSequence,
        seat: 1,
        team: 'white',
      });
      game = await secondPlayerApi.joinGame(game.gameId, {
        commandId: SECOND_JOIN_COMMAND_ID,
        expectedVersion: game.view.lastEventSequence,
        seat: 1,
        team: 'black',
      });
      game = await creatorApi.startGame(game.gameId, {
        commandId: START_COMMAND_ID,
        expectedVersion: game.view.lastEventSequence,
      });

      const pool = game.view.cardSelection?.pool ?? [];
      const queue = [
        creatorApi,
        secondPlayerApi,
        secondPlayerApi,
        creatorApi,
        creatorApi,
        secondPlayerApi,
      ];

      for (const [index, api] of queue.entries()) {
        const unitId = pool[index];

        if (unitId === undefined) {
          throw new Error('Expected a draft card.');
        }

        game = await api.confirmCardChoice(game.gameId, {
          commandId: crypto.randomUUID(),
          expectedVersion: game.view.lastEventSequence,
          unitId,
        });
      }

      const [, , , , , , unitId] = pool;

      if (unitId === undefined) {
        throw new Error('Expected the penultimate draft card.');
      }

      pendingGame = game;
      request = {
        commandId: CARD_CHOICE_COMMAND_ID,
        expectedVersion: game.view.lastEventSequence,
        unitId,
      };

      confirmedGame = await secondPlayerApi.confirmCardChoice(
        game.gameId,
        request
      );
    });

    test('returns an active game in the response to the penultimate confirmation', () => {
      expect(confirmedGame.view).toMatchObject({
        status: 'active',
        cardSelection: null,
        lastEventSequence: pendingGame.view.lastEventSequence + 4,
      });
    });

    test('persists the automatic card assignment for another participant', async () => {
      const savedGame = await createFakeGameApi(
        FAKE_SEED_IDENTIFIERS.firstUser
      ).getGame(confirmedGame.gameId);

      expect(savedGame.view.players.map((player) => player.cardIds)).toEqual(
        confirmedGame.view.players.map((player) => player.cardIds)
      );
      expect(
        savedGame.view.players.map((player) => player.cardIds.length)
      ).toEqual([4, 4]);
    });

    test('publishes the active stage to a spectator snapshot', async () => {
      const spectatorGame = await createFakeGameApi(
        FAKE_SEED_IDENTIFIERS.thirdUser
      ).getGame(confirmedGame.gameId);

      expect(spectatorGame.view).toMatchObject({
        status: 'active',
        cardSelection: null,
        currentPlayerId: FAKE_SEED_IDENTIFIERS.firstUser,
      });
    });

    test('does not duplicate automatic events when the final command is retried', async () => {
      const repeatedGame = await createFakeGameApi(
        FAKE_SEED_IDENTIFIERS.secondUser
      ).confirmCardChoice(confirmedGame.gameId, request);

      expect(repeatedGame).toEqual(confirmedGame);
    });
  });

  test('lets the creator swap both occupied positions', async () => {
    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const secondPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.secondUser);
    const createdGame = await creatorApi.createGame(CREATE_GAME_REQUEST);
    const creatorJoinedGame = await creatorApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });
    const secondPlayerJoinedGame = await secondPlayerApi.joinGame(
      createdGame.gameId,
      {
        commandId: SECOND_JOIN_COMMAND_ID,
        expectedVersion: creatorJoinedGame.view.lastEventSequence,
        seat: 1,
        team: 'black',
      }
    );

    const swappedGame = await creatorApi.swapPlayerPositions(
      createdGame.gameId,
      {
        commandId: SWAP_COMMAND_ID,
        expectedVersion: secondPlayerJoinedGame.view.lastEventSequence,
      }
    );

    expect(swappedGame.view.players).toEqual([
      expect.objectContaining({
        id: FAKE_SEED_IDENTIFIERS.firstUser,
        team: 'black',
      }),
      expect.objectContaining({
        id: FAKE_SEED_IDENTIFIERS.secondUser,
        team: 'white',
      }),
    ]);
  });

  test('lets a joined player leave a waiting lobby', async () => {
    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const secondPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.secondUser);
    const createdGame = await creatorApi.createGame(CREATE_GAME_REQUEST);
    const joinedGame = await secondPlayerApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'black',
    });

    await secondPlayerApi.leaveGame(createdGame.gameId, {
      commandId: LEAVE_COMMAND_ID,
      expectedVersion: joinedGame.view.lastEventSequence,
    });

    await expect(creatorApi.getGame(createdGame.gameId)).resolves.toMatchObject(
      {
        view: { lastEventSequence: 3, players: [], status: 'waiting' },
      }
    );
    await expect(secondPlayerApi.listLobbyGames()).resolves.toMatchObject({
      currentPlayerGameId: null,
    });
  });

  test('deletes a waiting lobby when its creator closes it', async () => {
    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const secondPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.secondUser);
    const createdGame = await creatorApi.createGame(CREATE_GAME_REQUEST);
    const joinedGame = await secondPlayerApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'black',
    });

    await creatorApi.leaveGame(createdGame.gameId, {
      commandId: LEAVE_COMMAND_ID,
      expectedVersion: joinedGame.view.lastEventSequence,
    });

    await expect(creatorApi.getGame(createdGame.gameId)).rejects.toMatchObject({
      code: 'game_not_found',
    });
  });

  test('lets a non-current player surrender and awards victory to the opponent', async () => {
    const creatorApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const secondPlayerApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.secondUser);
    const createdGame = await creatorApi.createGame(CREATE_GAME_REQUEST);
    const creatorJoinedGame = await creatorApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });
    const secondPlayerJoinedGame = await secondPlayerApi.joinGame(
      createdGame.gameId,
      {
        commandId: SECOND_JOIN_COMMAND_ID,
        expectedVersion: creatorJoinedGame.view.lastEventSequence,
        seat: 1,
        team: 'black',
      }
    );
    const startedGame = await creatorApi.startGame(createdGame.gameId, {
      commandId: START_COMMAND_ID,
      expectedVersion: secondPlayerJoinedGame.view.lastEventSequence,
    });

    const finishedGame = await secondPlayerApi.surrenderGame(
      createdGame.gameId,
      {
        commandId: SURRENDER_COMMAND_ID,
        expectedVersion: startedGame.view.lastEventSequence,
      }
    );

    expect(finishedGame.view).toMatchObject({
      players: [
        expect.objectContaining({ id: FAKE_SEED_IDENTIFIERS.firstUser }),
        expect.objectContaining({
          id: FAKE_SEED_IDENTIFIERS.secondUser,
          presence: 'defeated',
        }),
      ],
      status: 'finished',
      winnerTeam: 'white',
    });
  });

  test('does not create another game for a current player', async () => {
    const gameApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const createdGame = await gameApi.createGame(CREATE_GAME_REQUEST);
    await gameApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });

    await expect(
      gameApi.createGame(SECOND_CREATE_GAME_REQUEST)
    ).rejects.toMatchObject({ code: 'player_already_in_game' });
  });

  test('does not join a second game for a current player', async () => {
    const firstGameApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const secondGameApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.secondUser);
    const firstGame = await firstGameApi.createGame(CREATE_GAME_REQUEST);
    await firstGameApi.joinGame(firstGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: firstGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });
    const secondGame = await secondGameApi.createGame(
      SECOND_CREATE_GAME_REQUEST
    );

    await expect(
      firstGameApi.joinGame(secondGame.gameId, {
        commandId: THIRD_JOIN_COMMAND_ID,
        expectedVersion: secondGame.view.lastEventSequence,
        seat: 1,
        team: 'black',
      })
    ).rejects.toMatchObject({ code: 'player_already_in_game' });
  });

  test('reports the current player game in the lobby', async () => {
    const gameApi = createFakeGameApi(FAKE_SEED_IDENTIFIERS.firstUser);
    const createdGame = await gameApi.createGame(CREATE_GAME_REQUEST);
    await gameApi.joinGame(createdGame.gameId, {
      commandId: FIRST_JOIN_COMMAND_ID,
      expectedVersion: createdGame.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });

    const lobby = await gameApi.listLobbyGames();

    expect(lobby.currentPlayerGameId).toBe(createdGame.gameId);
  });
});
