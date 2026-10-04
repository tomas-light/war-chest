import { type Page, expect, test } from '@playwright/test';
import type {
  CreateGameRequest,
  GameEventsResponse,
  GameResponse,
  JoinGameRequest,
  PassTurnRequest,
  StartGameRequest,
} from '@war-chest/api-contracts';

const FIRST_PLAYER_ID = '10000000-0000-4000-8000-000000000001';
const SECOND_PLAYER_ID = '10000000-0000-4000-8000-000000000002';

test.use({ actionTimeout: 10_000 });

test.afterEach(async ({ context }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    for (const [index, openPage] of context.pages().entries()) {
      await openPage.screenshot({
        path: testInfo.outputPath(`failed-page-${index}.png`),
        fullPage: true,
      });
    }
  }
});

interface FakeApiModule {
  createFakeGameApi(this: void, userId: string): SetupGameApi;
}

interface SetupGameApi {
  createGame(request: CreateGameRequest): Promise<GameResponse>;
  getGame(gameId: string): Promise<GameResponse>;
  getGameEvents(gameId: string): Promise<GameEventsResponse>;
  joinGame(gameId: string, request: JoinGameRequest): Promise<GameResponse>;
  passTurn(gameId: string, request: PassTurnRequest): Promise<GameResponse>;
  startGame(gameId: string, request: StartGameRequest): Promise<GameResponse>;
}

interface AdvanceOptions {
  gameId: string;
  playerId: string;
  requireFootman: boolean;
}

test('recruits and deploys two footmen, then chooses each maneuver through its field wheel', async ({
  context,
  page,
}) => {
  test.setTimeout(150_000);

  await context.addInitScript(() => {
    localStorage.setItem(
      'war-chest-dev-backend',
      JSON.stringify({ state: { backend: 'fake' }, version: 0 })
    );
  });
  await page.goto('/');
  await signIn(page, 'archer@example.com');
  const secondPage = await context.newPage();
  await secondPage.goto('/');
  await signIn(secondPage, 'cavalry@example.com');

  const { gameId, playerId } = await page.evaluate(
    async (playerIds) => {
      const moduleUrl = '/src/shared/api/fake/createFakeGameApi.ts';
      const module: unknown = await import(moduleUrl);
      const { createFakeGameApi } = module as FakeApiModule;
      const firstApi = createFakeGameApi(playerIds.first);
      const secondApi = createFakeGameApi(playerIds.second);
      const originalRandom = Math.random;
      Math.random = fixedRandom;

      try {
        let game = await firstApi.createGame({
          commandId: crypto.randomUUID(),
          format: 'duel',
        });
        game = await firstApi.joinGame(game.gameId, {
          commandId: crypto.randomUUID(),
          expectedVersion: game.view.lastEventSequence,
          seat: 1,
          team: 'white',
        });
        game = await secondApi.joinGame(game.gameId, {
          commandId: crypto.randomUUID(),
          expectedVersion: game.view.lastEventSequence,
          seat: 1,
          team: 'black',
        });
        game = await firstApi.startGame(game.gameId, {
          commandId: crypto.randomUUID(),
          expectedVersion: game.view.lastEventSequence,
        });
        const player = game.view.players.find((player) =>
          player.cardIds.includes('footman')
        );

        if (player === undefined) {
          throw new Error('The deterministic duel must include Footman.');
        }

        return { gameId: game.gameId, playerId: player.id };
      } finally {
        Math.random = originalRandom;
      }

      function fixedRandom(): number {
        return 0.999;
      }
    },
    { first: FIRST_PLAYER_ID, second: SECOND_PLAYER_ID }
  );

  const actingPage = playerId === FIRST_PLAYER_ID ? page : secondPage;
  const observingPage = actingPage === page ? secondPage : page;
  await advanceToCoin(page, { gameId, playerId, requireFootman: false });
  await actingPage.goto(`/games/play/${gameId}`);
  await actingPage
    .getByRole('button', { name: /^(Жетон |Королевский жетон )/ })
    .first()
    .click();
  await actingPage.getByRole('button', { name: 'Нанять', exact: true }).click();
  await actingPage
    .getByRole('button', { name: 'Нанять: footman', exact: true })
    .click();
  await actingPage.getByRole('button', { name: 'Подтвердить ход' }).click();
  await expect(
    actingPage.getByRole('region', { name: 'Черновик хода' })
  ).toHaveCount(0);

  for (const deployedCount of [1, 2]) {
    const coinIndex = await advanceToCoin(page, {
      gameId,
      playerId,
      requireFootman: true,
    });
    await actingPage.goto(`/games/play/${gameId}`);
    await actingPage
      .getByRole('button', { name: /^(Жетон |Королевский жетон )/ })
      .nth(coinIndex)
      .click();
    await actingPage
      .getByRole('button', { name: 'Разыграть', exact: true })
      .click();
    await actingPage
      .getByRole('button', { name: /^Разыграть на клетку / })
      .first()
      .click();
    await actingPage.getByRole('button', { name: 'Подтвердить ход' }).click();
    await expect(
      actingPage.getByRole('region', { name: 'Черновик хода' })
    ).toHaveCount(0);
    await expect(
      actingPage.getByRole('img', { name: /^footman на клетке / })
    ).toHaveCount(deployedCount);

    if (deployedCount === 1) {
      const nextCoinIndex = await advanceToCoin(page, {
        gameId,
        playerId,
        requireFootman: true,
      });
      await actingPage.goto(`/games/play/${gameId}`);
      await actingPage
        .getByRole('button', {
          name: `Жетон footman ${nextCoinIndex + 1}`,
          exact: true,
        })
        .click();
      await actingPage
        .getByRole('button', { name: 'Манёвр', exact: true })
        .click();
      await expect(
        actingPage.getByRole('button', { name: 'Тактика', exact: true })
      ).toBeDisabled();
      await actingPage.keyboard.press('Escape');
      await actingPage.keyboard.press('Escape');
    }
  }

  const coinIndex = await advanceToCoin(page, {
    gameId,
    playerId,
    requireFootman: true,
  });
  await actingPage.setViewportSize({ width: 1440, height: 900 });
  await actingPage.goto(`/games/play/${gameId}`);
  await observingPage.goto(`/games/play/${gameId}`);
  await openTactic();
  const firstMovement = await chooseMovement();
  const firstUnit = actingPage.locator(
    `[data-unit-id="${firstMovement.unitId}"]`
  );
  const observedFirstUnit = observingPage.locator(
    `[data-unit-id="${firstMovement.unitId}"]`
  );
  await expect(firstUnit).toHaveAttribute(
    'data-cell-id',
    firstMovement.destination
  );
  await expect(observedFirstUnit).toHaveAttribute(
    'data-cell-id',
    firstMovement.source
  );
  await expect(
    actingPage.getByRole('button', { name: 'Подтвердить ход' })
  ).toBeDisabled();
  await actingPage.reload();
  await expect(
    actingPage.getByText('Выберите юнит «Пехотинец» для манёвра 2 из 2')
  ).toBeVisible();
  await expect(firstUnit).toHaveAttribute(
    'data-cell-id',
    firstMovement.destination
  );
  await actingPage.getByRole('button', { name: 'Отменить ход' }).click();
  await expect(firstUnit).toHaveAttribute('data-cell-id', firstMovement.source);

  await actingPage.setViewportSize({ width: 390, height: 900 });
  await openTactic();
  const repeatedFirstMovement = await chooseMovement();
  await expect(
    actingPage.getByRole('button', { name: /^Переместить footman с клетки / })
  ).toHaveCount(1);
  await actingPage.setViewportSize({ width: 320, height: 900 });
  const secondMovement = await chooseMovement();
  expect(secondMovement.unitId).not.toBe(repeatedFirstMovement.unitId);
  await expect(
    actingPage.getByRole('button', { name: 'Подтвердить ход' })
  ).toBeEnabled();
  await actingPage.reload();
  await expect(firstUnit).toHaveAttribute(
    'data-cell-id',
    repeatedFirstMovement.destination
  );
  await expect(
    actingPage.locator(`[data-unit-id="${secondMovement.unitId}"]`)
  ).toHaveAttribute('data-cell-id', secondMovement.destination);
  await expect(observedFirstUnit).toHaveAttribute(
    'data-cell-id',
    firstMovement.source
  );
  await actingPage.screenshot({
    path: 'test-results/footman-tactic-draft-320.png',
    fullPage: true,
  });
  await actingPage.getByRole('button', { name: 'Подтвердить ход' }).click();
  await expect(
    actingPage.getByRole('region', { name: 'Черновик хода' })
  ).toHaveCount(0);
  await expect(observedFirstUnit).toHaveAttribute(
    'data-cell-id',
    repeatedFirstMovement.destination
  );
  await expect(
    observingPage.locator(`[data-unit-id="${secondMovement.unitId}"]`)
  ).toHaveAttribute('data-cell-id', secondMovement.destination);
  const history = await page.evaluate(
    async (input) => {
      const moduleUrl = '/src/shared/api/fake/createFakeGameApi.ts';
      const module: unknown = await import(moduleUrl);
      const { createFakeGameApi } = module as FakeApiModule;
      return createFakeGameApi(input.playerId).getGameEvents(input.gameId);
    },
    { gameId, playerId }
  );
  const lastEvent = history.events.at(-1);
  expect(lastEvent?.type).toBe('TurnActionPerformed');

  if (lastEvent?.type !== 'TurnActionPerformed') {
    throw new Error('The tactic must be recorded in history.');
  }

  expect(lastEvent.payload.action).toEqual({
    type: 'tactic',
    unitId: 'footman',
    maneuvers: [
      {
        battlefieldUnitId: repeatedFirstMovement.unitId,
        cellId: repeatedFirstMovement.destination,
        type: 'move',
      },
      {
        battlefieldUnitId: secondMovement.unitId,
        cellId: secondMovement.destination,
        type: 'move',
      },
    ],
  });
  await actingPage.getByRole('button', { name: /выполнил тактику/ }).focus();
  const detail = actingPage.getByRole('dialog', { name: 'Детали хода' });
  await expect(
    detail.getByText(
      `${repeatedFirstMovement.source} → ${repeatedFirstMovement.destination}`,
      { exact: true }
    )
  ).toBeVisible();
  await expect(
    detail.getByText(
      `${secondMovement.source} → ${secondMovement.destination}`,
      { exact: true }
    )
  ).toBeVisible();

  async function openTactic(): Promise<void> {
    await actingPage
      .getByRole('button', { name: /^(Жетон |Королевский жетон )/ })
      .nth(coinIndex)
      .click();
    await expect(
      actingPage.getByRole('button', { name: 'Разыграть', exact: true })
    ).toBeDisabled();
    await actingPage
      .getByRole('button', { name: 'Манёвр', exact: true })
      .click();
    await actingPage
      .getByRole('button', { name: 'Тактика', exact: true })
      .click();
    await expect(
      actingPage.getByRole('button', { name: /^Переместить на клетку / })
    ).toHaveCount(0);
  }

  async function chooseMovement() {
    const unitButton = actingPage
      .getByRole('button', { name: /^Переместить footman с клетки / })
      .first();
    const unitId = await unitButton.locator('..').getAttribute('data-unit-id');
    const source = await unitButton.locator('..').getAttribute('data-cell-id');

    if (unitId === null || source === null) {
      throw new Error('The selected footman must have identity and location.');
    }

    await unitButton.focus();
    await actingPage.keyboard.press('Enter');
    const wheel = actingPage.locator('[data-wheel="maneuver"]');
    await expect(wheel).toBeVisible();
    await expect(
      wheel.getByRole('button', { name: 'Движение', exact: true })
    ).toBeEnabled();
    await expect(
      actingPage.getByRole('button', { name: /^Переместить на клетку / })
    ).toHaveCount(0);
    for (const name of ['Атака', 'Захват', 'Усилить', 'Тактика']) {
      await expect(
        wheel.getByRole('button', { name, exact: true })
      ).toBeDisabled();
    }

    await actingPage.screenshot({
      path: `test-results/footman-maneuver-wheel-${actingPage.viewportSize()?.width}.png`,
      fullPage: true,
    });
    await wheel.getByRole('button', { name: 'Движение', exact: true }).click();
    const target = actingPage
      .getByRole('button', { name: /^Переместить на клетку / })
      .first();
    const targetLabel = await target.getAttribute('aria-label');

    if (targetLabel === null) {
      throw new Error('Movement must have a target.');
    }

    const destination = targetLabel.replace('Переместить на клетку ', '');
    await target.click();
    await expect(
      actingPage.getByRole('region', { name: 'Черновик хода' })
    ).toBeVisible();
    return { destination, source, unitId };
  }
});

async function advanceToCoin(
  page: Page,
  options: AdvanceOptions
): Promise<number> {
  return page.evaluate(async (input) => {
    const moduleUrl = '/src/shared/api/fake/createFakeGameApi.ts';
    const module: unknown = await import(moduleUrl);
    const { createFakeGameApi } = module as FakeApiModule;

    for (let turn = 0; turn < 80; turn += 1) {
      const current = await createFakeGameApi(input.playerId).getGame(
        input.gameId
      );
      const currentPlayerId = current.view.currentPlayerId;

      if (currentPlayerId === null) {
        throw new Error('The duel must have a current player.');
      }

      const api = createFakeGameApi(currentPlayerId);
      const game = await api.getGame(input.gameId);
      const hand = game.view.battlefield?.playerResources.find(
        (resources) => resources.playerId === currentPlayerId
      )?.hand;
      const coinIndex =
        hand?.findIndex(
          (coin) =>
            !input.requireFootman ||
            (coin.kind === 'unit' && coin.unitId === 'footman')
        ) ?? -1;

      if (currentPlayerId === input.playerId && coinIndex >= 0) {
        return coinIndex;
      }

      await api.passTurn(input.gameId, {
        coinIndex: 0,
        commandId: crypto.randomUUID(),
        expectedVersion: game.view.lastEventSequence,
      });
    }

    throw new Error('No footman coin appeared after 80 turns.');
  }, options);
}

async function signIn(page: Page, email: string): Promise<void> {
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из письма').fill('123456');
  await page.getByLabel('Код из письма').press('Enter');
  await expect(page).toHaveURL(/\/lobby$/);
}
