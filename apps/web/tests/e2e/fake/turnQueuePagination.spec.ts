import { expect, test } from '@playwright/test';
import type {
  CreateGameRequest,
  GameResponse,
  JoinGameRequest,
  PassTurnRequest,
  StartGameRequest,
} from '@war-chest/api-contracts';

interface SetupGameApi {
  createGame(request: CreateGameRequest): Promise<GameResponse>;
  getGame(gameId: string): Promise<GameResponse>;
  joinGame(gameId: string, request: JoinGameRequest): Promise<GameResponse>;
  passTurn(gameId: string, request: PassTurnRequest): Promise<GameResponse>;
  startGame(gameId: string, request: StartGameRequest): Promise<GameResponse>;
}

interface FakeApiModule {
  createFakeGameApi(this: void, userId: string): SetupGameApi;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'war-chest-dev-backend',
      JSON.stringify({ state: { backend: 'fake' }, version: 0 })
    );
  });
  await page.goto('/login');
  await page.getByLabel('Email').fill('archer@example.com');
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из письма').fill('123456');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/lobby$/);

  const gameId = await page.evaluate(async () => {
    const moduleUrl = '/src/shared/api/fake/createFakeGameApi.ts';
    const module: unknown = await import(moduleUrl);
    const { createFakeGameApi } = module as FakeApiModule;
    const first = createFakeGameApi('10000000-0000-4000-8000-000000000001');
    const second = createFakeGameApi('10000000-0000-4000-8000-000000000002');
    let game = await first.createGame({
      commandId: crypto.randomUUID(),
      format: 'duel',
    });
    game = await first.joinGame(game.gameId, {
      commandId: crypto.randomUUID(),
      expectedVersion: game.view.lastEventSequence,
      seat: 1,
      team: 'white',
    });
    game = await second.joinGame(game.gameId, {
      commandId: crypto.randomUUID(),
      expectedVersion: game.view.lastEventSequence,
      seat: 1,
      team: 'black',
    });
    game = await first.startGame(game.gameId, {
      commandId: crypto.randomUUID(),
      expectedVersion: game.view.lastEventSequence,
    });

    for (let turn = 0; turn < 52; turn += 1) {
      const current = createFakeGameApi(game.view.currentPlayerId ?? '');
      const currentGame = await current.getGame(game.gameId);
      game = await current.passTurn(game.gameId, {
        coinIndex: 0,
        commandId: crypto.randomUUID(),
        expectedVersion: currentGame.view.lastEventSequence,
      });
    }

    return game.gameId;
  });
  await page.goto(`/games/play/${gameId}`);
});

test('opens the latest full page and prepends older pages on upward scrolling without moving existing turns', async ({
  page,
}) => {
  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const viewport = queue.getByRole('list');
  const firstStep = viewport.getByRole('listitem').first();
  await expect(firstStep).toHaveAttribute('aria-setsize', '23');
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  await viewport.evaluate((element) => {
    element.scrollTop = 9;
  });
  await expect(firstStep).toHaveAttribute('aria-posinset', '1');
  const previousFirstSequence = await firstStep.getAttribute('data-sequence');

  await viewport.hover();
  await page.mouse.wheel(0, -500);
  await expect(firstStep).toHaveAttribute('aria-setsize', '43');
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBe(1240);
  const preservedStep = queue.locator(
    `[data-sequence="${previousFirstSequence}"]`
  );
  const viewportBounds = await viewport.boundingBox();
  const preservedBounds = await preservedStep.boundingBox();
  expect(viewportBounds).not.toBeNull();
  expect(preservedBounds).not.toBeNull();
  expect(preservedBounds?.y).toBe(viewportBounds?.y);

  await page.mouse.wheel(0, -2000);
  await expect(firstStep).toHaveAttribute('aria-setsize', '55');
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBe(744);

  await page.mouse.wheel(0, -2000);
  await expect(
    queue.getByRole('button', { name: 'Загрузить предыдущие ходы' })
  ).toBeDisabled();
});

test('loads an older full page by dragging the rail to the top boundary', async ({
  page,
}) => {
  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const viewport = queue.getByRole('list');
  const firstStep = viewport.getByRole('listitem').first();
  await expect(firstStep).toHaveAttribute('aria-setsize', '23');
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await viewport.evaluate((element) => {
    element.scrollTop = 9;
  });
  await expect(firstStep).toHaveAttribute('aria-posinset', '1');
  const bounds = await viewport.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) {
    return;
  }

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 50);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 150);
  await page.mouse.up();
  await expect(firstStep).toHaveAttribute('aria-setsize', '43');
});

test('loads an older full page by pulling the mobile rail down with touch', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const viewport = queue.getByRole('list');
  const firstStep = viewport.getByRole('listitem').first();
  await expect(firstStep).toHaveAttribute('aria-setsize', '23');
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await viewport.evaluate((element) => {
    element.scrollTop = 9;
  });
  await expect(firstStep).toHaveAttribute('aria-posinset', '1');
  const bounds = await viewport.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) {
    return;
  }

  const session = await page.context().newCDPSession(page);
  const startX = bounds.x + bounds.width / 2;
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: bounds.y + 50 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: startX, y: bounds.y + 120 }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(firstStep).toHaveAttribute('aria-setsize', '43');
});
