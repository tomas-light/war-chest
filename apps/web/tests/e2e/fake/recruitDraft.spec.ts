import { type Locator, type Page, expect, test } from '@playwright/test';
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
type FakeApiModule = {
  createFakeGameApi(this: void, userId: string): SetupGameApi;
};

interface FakeClientModule {
  createFakeGameApiClient(this: void): SetupGameApi;
}

type SetupGameApi = {
  createGame(request: CreateGameRequest): Promise<GameResponse>;
  getGame(gameId: string): Promise<GameResponse>;
  getGameEvents(gameId: string): Promise<GameEventsResponse>;
  joinGame(gameId: string, request: JoinGameRequest): Promise<GameResponse>;
  passTurn(gameId: string, request: PassTurnRequest): Promise<GameResponse>;
  startGame(gameId: string, request: StartGameRequest): Promise<GameResponse>;
};

test('recruits, deploys and moves through private drafts in fake API', async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);

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

  const { gameId, handCount, playerId } = await page.evaluate(
    async (playerIds) => {
      const moduleUrl = '/src/shared/api/fake/createFakeGameApi.ts';
      const fakeApiModule: unknown = await import(moduleUrl);
      const { createFakeGameApi } = fakeApiModule as FakeApiModule;
      const firstPlayerApi = createFakeGameApi(playerIds.first);
      const secondPlayerApi = createFakeGameApi(playerIds.second);
      const originalRandom = Math.random;

      Math.random = fixedRandom;

      try {
        let game = await firstPlayerApi.createGame({
          commandId: crypto.randomUUID(),
          format: 'duel',
        });
        game = await firstPlayerApi.joinGame(game.gameId, {
          commandId: crypto.randomUUID(),
          expectedVersion: game.view.lastEventSequence,
          seat: 1,
          team: 'white',
        });
        game = await secondPlayerApi.joinGame(game.gameId, {
          commandId: crypto.randomUUID(),
          expectedVersion: game.view.lastEventSequence,
          seat: 1,
          team: 'black',
        });
        game = await firstPlayerApi.startGame(game.gameId, {
          commandId: crypto.randomUUID(),
          expectedVersion: game.view.lastEventSequence,
        });

        if (game.view.currentPlayerId === null) {
          throw new Error('The started duel has no current player.');
        }

        const currentPlayerApi =
          game.view.currentPlayerId === playerIds.first
            ? firstPlayerApi
            : secondPlayerApi;
        const currentGame = await currentPlayerApi.getGame(game.gameId);
        const resources = currentGame.view.battlefield?.playerResources.find(
          (item) => item.playerId === game.view.currentPlayerId
        );

        return {
          gameId: game.gameId,
          handCount: resources?.handCount ?? 0,
          playerId: game.view.currentPlayerId,
        };
      } finally {
        Math.random = originalRandom;
      }

      function fixedRandom(): number {
        return 0.999;
      }
    },
    { first: FIRST_PLAYER_ID, second: SECOND_PLAYER_ID }
  );

  expect(handCount).toBeGreaterThan(0);

  const currentPage = playerId === FIRST_PLAYER_ID ? page : secondPage;

  await currentPage.goto(`/games/play/${gameId}`);
  await expect(
    currentPage.getByRole('region', { name: 'Игровое поле' })
  ).toBeVisible();

  const opponentPage = currentPage === page ? secondPage : page;

  await chooseRecruitTarget();
  await expect(
    currentPage.getByRole('region', { name: 'Черновик хода' })
  ).toBeVisible();

  await currentPage.reload();
  await expect(
    currentPage.getByRole('region', { name: 'Черновик хода' })
  ).toBeVisible();
  await currentPage.getByRole('button', { name: 'Отменить ход' }).click();
  await expect(
    currentPage.getByRole('region', { name: 'Черновик хода' })
  ).toHaveCount(0);

  await chooseRecruitTarget();
  await currentPage.getByRole('button', { name: 'Подтвердить ход' }).click();
  await expect(
    currentPage.getByRole('region', { name: 'Черновик хода' })
  ).toHaveCount(0);
  await expect(
    currentPage.getByRole('button', { name: /нанял жетон/ })
  ).toBeVisible();
  await expect(
    currentPage
      .getByRole('button', { name: /нанял жетон/ })
      .locator('img')
      .last()
  ).toHaveAttribute('src', /recruitIcon/);

  await opponentPage.goto(`/games/play/${gameId}`);
  await expect(
    opponentPage.getByRole('img', { name: /^Открытый жетон / })
  ).toBeVisible();
  await expect(opponentPage.getByText('Закрыто', { exact: true })).toHaveCount(
    0
  );
  await expect(opponentPage.getByText('Открыто', { exact: true })).toHaveCount(
    0
  );

  const deployOpportunity = await page.evaluate(
    async ({ firstPlayerId, gameId }) => {
      const moduleUrl = '/src/shared/api/fake/createFakeGameApi.ts';
      const fakeApiModule: unknown = await import(moduleUrl);
      const { createFakeGameApi } = fakeApiModule as FakeApiModule;
      const supportedUnits = new Set([
        'lightCavalry',
        'cavalry',
        'crossbowman',
        'swordsman',
      ]);

      for (let turn = 0; turn < 12; turn += 1) {
        const firstPlayerApi = createFakeGameApi(firstPlayerId);
        const firstPlayerGame = await firstPlayerApi.getGame(gameId);
        const playerId = firstPlayerGame.view.currentPlayerId;

        if (playerId === null) {
          throw new Error('The duel has no current player.');
        }

        const currentPlayerApi = createFakeGameApi(playerId);
        const game = await currentPlayerApi.getGame(gameId);
        const hand = game.view.battlefield?.playerResources.find(
          (resources) => resources.playerId === playerId
        )?.hand;
        const coinIndex = hand?.findIndex(
          (coin) => coin.kind === 'unit' && supportedUnits.has(coin.unitId)
        );

        if (coinIndex !== undefined && coinIndex >= 0) {
          return { coinIndex, playerId };
        }

        if (hand === undefined || hand === null || hand.length === 0) {
          throw new Error('The current player cannot pass a coin.');
        }

        await currentPlayerApi.passTurn(gameId, {
          coinIndex: 0,
          commandId: crypto.randomUUID(),
          expectedVersion: game.view.lastEventSequence,
        });
      }

      throw new Error('No deployable coin appeared after 12 turns.');
    },
    {
      firstPlayerId: FIRST_PLAYER_ID,
      gameId,
    }
  );

  const deployPage =
    deployOpportunity.playerId === FIRST_PLAYER_ID ? page : secondPage;
  await deployPage.goto(`/games/play/${gameId}`);
  await deployPage
    .getByRole('button', { name: /^Жетон / })
    .nth(deployOpportunity.coinIndex)
    .click();
  await deployPage.getByRole('button', { name: 'Разыграть' }).click();

  const deployTarget = deployPage
    .getByRole('button', {
      name: /^Разыграть на клетку /,
    })
    .first();
  const targetCellName = await deployTarget
    .locator('..')
    .getAttribute('aria-label');

  if (targetCellName === null) {
    throw new Error('The deploy target has no battlefield cell.');
  }

  const targetCell = deployPage.getByRole('gridcell', { name: targetCellName });
  await expect(deployTarget).toBeVisible();
  await expectCircle(deployTarget);

  await deployPage.setViewportSize({ height: 844, width: 390 });
  await expectCircle(deployTarget);
  await expect(deployPage.getByText(/^Инициатива ·/)).toHaveCount(0);
  await expect(
    deployPage.getByRole('img', { name: /^Открытый жетон / })
  ).toBeVisible();
  await deployTarget.click();
  await expect(
    deployPage.getByRole('region', { name: 'Черновик хода' })
  ).toBeVisible();
  await deployPage.getByRole('button', { name: 'Подтвердить ход' }).click();
  await expect(
    deployPage.getByRole('region', { name: 'Черновик хода' })
  ).toHaveCount(0);

  const deployedToken = deployPage.getByRole('img', {
    name: /^(cavalry|crossbowman|lightCavalry|swordsman) на клетке /,
  });
  await expect(deployedToken).toBeVisible();
  await expectFieldTokenSize(targetCell, deployedToken);
  const underUnitSelection = targetCell.locator('img[aria-hidden="true"]');
  await expect(underUnitSelection).toBeVisible();
  await expectCircle(underUnitSelection);
  await expect(
    deployPage
      .getByRole('button', { name: /разыграл юнита/ })
      .locator('img')
      .last()
  ).toHaveAttribute('src', /deployIcon/);

  await deployPage.setViewportSize({ height: 900, width: 1440 });
  await expectFieldTokenSize(targetCell, deployedToken);
  await expectCircle(underUnitSelection);

  const movementOpportunity = await page.evaluate(
    async ({ firstPlayerId, gameId }) => {
      const moduleUrl = '/src/shared/api/fake/createFakeGameApi.ts';
      const fakeApiModule: unknown = await import(moduleUrl);
      const { createFakeGameApi } = fakeApiModule as FakeApiModule;

      for (let turn = 0; turn < 36; turn += 1) {
        const game = await createFakeGameApi(firstPlayerId).getGame(gameId);
        const playerId = game.view.currentPlayerId;

        if (playerId === null) {
          throw new Error('The active duel must have a current player.');
        }

        const currentPlayerApi = createFakeGameApi(playerId);
        const currentGame = await currentPlayerApi.getGame(gameId);
        const unit = currentGame.view.battlefield?.units.find(
          (unit) => unit.ownerId === playerId
        );
        const hand = currentGame.view.battlefield?.playerResources.find(
          (resources) => resources.playerId === playerId
        )?.hand;
        const coinIndex =
          hand?.findIndex(
            (coin) => coin.kind === 'unit' && coin.unitId === unit?.unitId
          ) ?? -1;

        if (unit !== undefined && coinIndex >= 0) {
          return {
            battlefieldUnitId: unit.id,
            coinIndex,
            from: unit.cellId,
            playerId,
            unitId: unit.unitId,
          };
        }

        await currentPlayerApi.passTurn(gameId, {
          coinIndex: 0,
          commandId: crypto.randomUUID(),
          expectedVersion: currentGame.view.lastEventSequence,
        });
      }

      throw new Error('No matching movement coin appeared after 36 turns.');
    },
    { firstPlayerId: FIRST_PLAYER_ID, gameId }
  );

  const movePage =
    movementOpportunity.playerId === FIRST_PLAYER_ID ? page : secondPage;
  const observingPage = movePage === page ? secondPage : page;

  await movePage.goto(`/games/play/${gameId}`);
  await observingPage.goto(`/games/play/${gameId}`);
  const movingUnit = movePage.locator(
    `[data-unit-id="${movementOpportunity.battlefieldUnitId}"]`
  );
  const observedUnit = observingPage.locator(
    `[data-unit-id="${movementOpportunity.battlefieldUnitId}"]`
  );

  await chooseMovement();
  await movePage.screenshot({
    path: 'test-results/move-selection-desktop.png',
    fullPage: true,
  });
  const moveTarget = movePage
    .getByRole('button', { name: /^Переместить на клетку / })
    .first();
  const targetLabel = await moveTarget.getAttribute('aria-label');
  const destinationCell = targetLabel?.replace('Переместить на клетку ', '');

  if (destinationCell === undefined) {
    throw new Error('Movement must offer an adjacent target.');
  }

  await moveTarget.click();
  await expect(movingUnit).toHaveAttribute('data-cell-id', destinationCell);
  await expect(observedUnit).toHaveAttribute(
    'data-cell-id',
    movementOpportunity.from
  );
  await movePage.getByRole('button', { name: 'Отменить ход' }).click();
  await expect(movingUnit).toHaveAttribute(
    'data-cell-id',
    movementOpportunity.from
  );
  await expect(observedUnit).toHaveAttribute(
    'data-cell-id',
    movementOpportunity.from
  );

  await movePage.setViewportSize({ height: 844, width: 390 });
  await chooseMovement();
  await movePage.screenshot({
    path: 'test-results/move-selection-mobile.png',
    fullPage: true,
  });
  await movePage
    .getByRole('button', {
      name: `Переместить на клетку ${destinationCell}`,
      exact: true,
    })
    .focus();
  await movePage.keyboard.press('Enter');
  await expect(movingUnit).toHaveAttribute('data-cell-id', destinationCell);
  await movePage.reload();
  await expect(movingUnit).toHaveAttribute('data-cell-id', destinationCell);

  await expect(
    movePage.getByRole('region', { name: 'Черновик хода' })
  ).toBeVisible();
  await movePage.screenshot({
    path: 'test-results/move-draft-mobile.png',
    fullPage: true,
  });
  await movePage.getByRole('button', { name: 'Подтвердить ход' }).click();
  await expect(
    movePage.getByRole('region', { name: 'Черновик хода' })
  ).toHaveCount(0);
  await expect(observedUnit).toHaveAttribute('data-cell-id', destinationCell);
  await expect(
    observingPage
      .getByRole('img', {
        name: `Открытый жетон ${movementOpportunity.unitId}`,
        exact: true,
      })
      .last()
  ).toBeVisible();
  await expect(
    movePage.getByRole('button', { name: /переместил юнита/ })
  ).toBeVisible();
  await movePage.reload();
  await expect(movingUnit).toHaveAttribute('data-cell-id', destinationCell);

  const historySequences = await movePage.evaluate(
    async ({ gameId, playerId }) => {
      const moduleUrl = '/src/shared/api/fake/createFakeGameApi.ts';
      const module: unknown = await import(moduleUrl);
      const { createFakeGameApi } = module as FakeApiModule;
      const history = await createFakeGameApi(playerId).getGameEvents(gameId);
      const turns = history.events.filter(
        (event) =>
          event.type === 'TurnPassed' || event.type === 'TurnActionPerformed'
      );
      const move = turns.at(-1);
      const previous = turns.at(-2);

      if (move === undefined || previous === undefined) {
        throw new Error(
          'Move history must contain the move and its preceding turn.'
        );
      }

      return { move: move.sequence, previous: previous.sequence };
    },
    { gameId, playerId: movementOpportunity.playerId }
  );
  const queue = movePage.getByRole('complementary', { name: 'Очередь ходов' });
  const moveStep = queue.locator(
    `[data-sequence="${historySequences.move}"] button`
  );
  const previousStep = queue.locator(
    `[data-sequence="${historySequences.previous}"] button`
  );

  for (const width of [1440, 390, 320]) {
    await movePage.setViewportSize({ height: 900, width });
    const tableBefore = await movePage
      .getByRole('region', { name: 'Игровое поле' })
      .boundingBox();
    await moveStep.focus();
    const detail = movePage.getByRole('dialog', { name: 'Детали хода' });
    await expect(
      detail.getByText(`${movementOpportunity.from} → ${destinationCell}`, {
        exact: true,
      })
    ).toBeVisible();
    const tableAfter = await movePage
      .getByRole('region', { name: 'Игровое поле' })
      .boundingBox();
    expect(tableAfter).toEqual(tableBefore);
    const detailBounds = await detail.boundingBox();
    expect(detailBounds?.x).toBeGreaterThan(0);
    expect(
      (detailBounds?.x ?? 0) + (detailBounds?.width ?? 0)
    ).toBeLessThanOrEqual(width);
    await movePage.screenshot({
      path: `test-results/history-detail-${width}.png`,
      fullPage: true,
    });
    await movePage.keyboard.press('Escape');
    await expect(detail).toHaveCount(0);
    await expect(moveStep).toBeFocused();
    if (width === 1440) {
      await previousStep.hover();
    } else {
      await previousStep.focus();
    }

    await expect(detail).toBeVisible();
    await previousStep.click();
    await expect(previousStep).toHaveAttribute('aria-current', 'step');
    await expect(previousStep).toHaveAttribute('aria-expanded', 'true');
    await expect(detail).toBeVisible();
    await expect(movingUnit).toHaveAttribute(
      'data-cell-id',
      movementOpportunity.from
    );
    await expect(
      movePage.getByRole('button', { name: /^(Жетон |Королевский жетон )/ })
    ).toHaveCount(0);
    await expect(movePage.getByText('СЕЙЧАС', { exact: true })).toBeVisible();
    await movePage.screenshot({
      path: `test-results/history-review-${width}.png`,
      fullPage: true,
    });
    await movePage
      .getByRole('button', { name: 'Вернуться к текущему ходу', exact: true })
      .focus();
    await movePage.keyboard.press('Enter');
    await expect(movingUnit).toHaveAttribute('data-cell-id', destinationCell);
    await expect(movePage.getByText('СЕЙЧАС', { exact: true })).toHaveCount(0);
  }

  await movePage.setViewportSize({ height: 900, width: 1440 });
  await previousStep.click();
  const newTurnSequence = await observingPage.evaluate(async (gameId) => {
    const moduleUrl = '/src/shared/api/fake/createFakeGameApiClient.ts';
    const module: unknown = await import(moduleUrl);
    const { createFakeGameApiClient } = module as FakeClientModule;
    const client = createFakeGameApiClient();
    const game = await client.getGame(gameId);
    const passed = await client.passTurn(gameId, {
      coinIndex: 0,
      commandId: crypto.randomUUID(),
      expectedVersion: game.view.lastEventSequence,
    });

    return passed.view.lastEventSequence;
  }, gameId);
  await expect(
    queue.locator(`[data-sequence="${newTurnSequence}"]`)
  ).toBeVisible();
  await expect(movingUnit).toHaveAttribute(
    'data-cell-id',
    movementOpportunity.from
  );
  await expect(previousStep).toHaveAttribute('aria-current', 'step');
  await movePage
    .getByRole('button', { name: 'Проиграть историю до текущего хода' })
    .focus();
  await movePage.keyboard.press('Enter');
  await movePage.getByRole('button', { name: 'Приостановить replay' }).click();
  await expect(movePage.getByText('Пауза', { exact: true })).toBeVisible();
  await movePage.waitForTimeout(1200);
  await expect(movingUnit).toHaveAttribute(
    'data-cell-id',
    movementOpportunity.from
  );
  await movePage
    .getByRole('button', { name: 'Проиграть историю до текущего хода' })
    .click();
  await expect(movingUnit).toHaveAttribute('data-cell-id', destinationCell);
  await expect(movePage.getByText('СЕЙЧАС', { exact: true })).toHaveCount(0);

  async function chooseMovement(): Promise<void> {
    await movePage
      .getByRole('button', { name: /^(Жетон |Королевский жетон )/ })
      .nth(movementOpportunity.coinIndex)
      .click();
    await movePage.getByRole('button', { name: 'Манёвр' }).click();
    await expect(movePage.locator('[data-wheel="maneuver"]')).toBeVisible();
    await movePage
      .getByRole('button', { name: 'Движение', exact: true })
      .click();
    const unitButton = movePage.getByRole('button', {
      name: `Переместить ${movementOpportunity.unitId} с клетки ${movementOpportunity.from}`,
      exact: true,
    });
    await expect(unitButton).toHaveAttribute('aria-pressed', 'true');
    await expect(
      movePage.getByText('Выберите подсвеченного юнита для перемещения')
    ).toHaveCount(0);
    await expect(
      movePage.getByText('Выберите подсвеченную соседнюю клетку')
    ).toBeVisible();
  }

  async function chooseRecruitTarget(): Promise<void> {
    await currentPage
      .getByRole('button', { name: /^Жетон / })
      .first()
      .click();
    await currentPage.getByRole('button', { name: 'Нанять' }).click();
    await expect(
      currentPage.getByRole('button', { name: 'Отменить выбор' })
    ).toBeVisible();
    await expect(
      currentPage.getByRole('region', { name: 'Выбор цели действия' })
    ).toHaveCount(0);
    await currentPage
      .getByRole('button', { name: /^Нанять:/ })
      .first()
      .click();
  }
});

async function expectCircle(target: Locator): Promise<void> {
  const bounds = await target.boundingBox();

  expect(bounds).not.toBeNull();
  expect(Math.abs((bounds?.width ?? 0) - (bounds?.height ?? 0))).toBeLessThan(
    1
  );
}

async function expectFieldTokenSize(
  cell: Locator,
  token: Locator
): Promise<void> {
  const cellBounds = await cell.boundingBox();
  const tokenBounds = await token.boundingBox();

  expect(cellBounds).not.toBeNull();
  expect(tokenBounds).not.toBeNull();
  expect((tokenBounds?.width ?? 0) / (cellBounds?.width ?? 1)).toBeCloseTo(
    92 / 140,
    1
  );
}

async function signIn(page: Page, email: string): Promise<void> {
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из письма').fill('123456');
  await page.getByLabel('Код из письма').press('Enter');
  await expect(page).toHaveURL(/\/lobby$/);
}
