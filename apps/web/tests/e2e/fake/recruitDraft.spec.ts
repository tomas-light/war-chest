import { type Locator, type Page, expect, test } from '@playwright/test';
import type {
  CreateGameRequest,
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

type SetupGameApi = {
  createGame(request: CreateGameRequest): Promise<GameResponse>;
  getGame(gameId: string): Promise<GameResponse>;
  joinGame(gameId: string, request: JoinGameRequest): Promise<GameResponse>;
  passTurn(gameId: string, request: PassTurnRequest): Promise<GameResponse>;
  startGame(gameId: string, request: StartGameRequest): Promise<GameResponse>;
};

test('recruits and deploys through private drafts in fake API', async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);

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
