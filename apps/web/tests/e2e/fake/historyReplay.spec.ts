import { expect, test } from '@playwright/test';
import type {
  CreateGameRequest,
  GameResponse,
  JoinGameRequest,
  PassTurnRequest,
  StartGameRequest,
  SurrenderGameRequest,
} from '@war-chest/api-contracts';

interface SetupGameApi {
  createGame(request: CreateGameRequest): Promise<GameResponse>;
  getGame(gameId: string): Promise<GameResponse>;
  joinGame(gameId: string, request: JoinGameRequest): Promise<GameResponse>;
  passTurn(gameId: string, request: PassTurnRequest): Promise<GameResponse>;
  startGame(gameId: string, request: StartGameRequest): Promise<GameResponse>;
  surrenderGame(
    gameId: string,
    request: SurrenderGameRequest
  ): Promise<GameResponse>;
}

interface FakeApiModule {
  createFakeGameApi(this: void, userId: string): SetupGameApi;
}

interface FakeClientModule {
  createFakeGameApiClient(this: void): SetupGameApi;
}

test.use({ hasTouch: true, viewport: { height: 844, width: 390 } });

test('touch previews a completed turn before navigation and retains history when the game finishes', async ({
  context,
  page,
}) => {
  await context.addInitScript(() => {
    localStorage.setItem(
      'war-chest-dev-backend',
      JSON.stringify({ state: { backend: 'fake' }, version: 0 })
    );
  });
  await page.goto('/');
  await page.getByLabel('Email').fill('archer@example.com');
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из письма').fill('123456');
  await page.getByRole('button', { name: 'Войти', exact: true }).tap();
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

    for (let turn = 0; turn < 3; turn += 1) {
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
  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const turn = queue.locator('[data-sequence]').first().getByRole('button');
  await turn.tap();
  const detail = page.getByRole('dialog', { name: 'Детали хода' });
  await expect(detail.getByText('Пас', { exact: true })).toBeVisible();
  await expect(detail.getByText('Пас', { exact: true })).toHaveCSS(
    'font-family',
    /"Segoe UI"/
  );
  await expect(detail.getByText('Пас', { exact: true })).toHaveCSS(
    'font-size',
    '16px'
  );
  await page.setViewportSize({ height: 900, width: 1440 });
  await expect(detail.getByText('Пас', { exact: true })).toHaveCSS(
    'font-family',
    /"Segoe UI"/
  );
  await expect(detail.getByText('Пас', { exact: true })).toHaveCSS(
    'font-size',
    '16px'
  );
  await page.screenshot({
    path: 'test-results/history-pass-detail-1440.png',
    fullPage: true,
  });
  await expect(turn).not.toHaveAttribute('aria-current', 'step');
  await expect(page.getByText('СЕЙЧАС', { exact: true })).toHaveCount(0);
  await page.setViewportSize({ height: 844, width: 320 });
  const bounds = await detail.boundingBox();
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(320);
  await page.screenshot({
    path: 'test-results/history-touch-detail-320.png',
    fullPage: true,
  });
  await detail.getByRole('button', { name: 'Показать этот ход' }).tap();
  await expect(turn).toHaveAttribute('aria-current', 'step');
  await expect(
    page.getByRole('button', { name: 'Проиграть историю до текущего хода' })
  ).toBeVisible();

  await page.evaluate(async (gameId) => {
    const moduleUrl = '/src/shared/api/fake/createFakeGameApiClient.ts';
    const module: unknown = await import(moduleUrl);
    const { createFakeGameApiClient } = module as FakeClientModule;
    const first = createFakeGameApiClient();
    const game = await first.getGame(gameId);
    await first.surrenderGame(gameId, {
      commandId: crypto.randomUUID(),
      expectedVersion: game.view.lastEventSequence,
    });
  }, gameId);

  await expect(
    queue.getByRole('button', { name: /^Сейчас ходит / })
  ).toHaveCount(0);
  await expect(turn).toHaveAttribute('aria-current', 'step');
  await page
    .getByRole('button', { name: 'Вернуться к текущему ходу', exact: true })
    .tap();
  await expect(page.getByText('Вы сдались', { exact: true })).toBeVisible();
  await expect(queue).toBeVisible();
  await turn.tap();
  await page
    .getByRole('dialog', { name: 'Детали хода' })
    .getByRole('button', { name: 'Показать этот ход' })
    .tap();
  await expect(turn).toHaveAttribute('aria-current', 'step');
});
