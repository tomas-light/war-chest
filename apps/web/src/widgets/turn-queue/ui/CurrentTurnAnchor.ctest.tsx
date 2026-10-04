import { expect, test } from '@playwright/test';

test.use({ locale: 'ru-RU' });

test('keyboard focus reveals replay controls on the 44px avatar overlay', async ({
  page,
}) => {
  await page.goto(
    '/?story=widgets/turn-queue/ui/CurrentTurnAnchor/ReplayControls'
  );
  const play = page.getByRole('button', {
    name: 'Проиграть историю до текущего хода',
  });
  await expect(play).toBeAttached();
  const anchor = page.locator('[data-state]');
  await play.hover();
  await anchor.screenshot({
    path: 'test-results/current-turn-hover.png',
  });
  await page.mouse.move(300, 300);
  await page.keyboard.press('Tab');
  await expect(play).toBeFocused();
  await expect(play.locator('..')).toHaveCSS('opacity', '1');
  await expect(play.locator('..')).toHaveCSS('width', '44px');
  await expect(play.locator('..')).toHaveCSS('height', '44px');
  await expect(play.locator('..').locator('img:visible')).toHaveCSS(
    'width',
    '48px'
  );
  await expect(play.locator('..').locator('img:visible')).toHaveCSS(
    'height',
    '44px'
  );
  await anchor.screenshot({
    path: 'test-results/current-turn-focus.png',
  });
  await page.keyboard.down('Space');
  await anchor.screenshot({
    path: 'test-results/current-turn-pressed.png',
  });
  await page.keyboard.up('Space');
  await expect(
    page.getByRole('button', { name: 'Приостановить replay' })
  ).toBeVisible();
  await anchor.screenshot({
    path: 'test-results/current-turn-playing.png',
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ height: 844, width });
    await page.getByRole('button', { name: 'Приостановить replay' }).click();
    await page.mouse.move(300, 300);
    await anchor.screenshot({
      path: `test-results/current-turn-mobile-${width}.png`,
    });
    await page
      .getByRole('button', { name: 'Проиграть историю до текущего хода' })
      .click();
  }
});

test('pause keeps the approved controls on the current avatar', async ({
  page,
}) => {
  await page.goto(
    '/?story=widgets/turn-queue/ui/CurrentTurnAnchor/ReplayControls'
  );
  await page
    .getByRole('button', { name: 'Проиграть историю до текущего хода' })
    .focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Приостановить replay' }).click();

  await expect(page.getByText('Пауза', { exact: true })).toBeVisible();
  await page.locator('[data-state]').screenshot({
    path: 'test-results/current-turn-paused.png',
  });
  await expect(
    page.getByRole('button', { name: 'Проиграть историю до текущего хода' })
  ).toBeVisible();
});

test('loading uses the dedicated spinner and respects reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(
    '/?story=widgets/turn-queue/ui/CurrentTurnAnchor/ReplayLoading'
  );

  const spinner = page.locator(
    '[data-state="loading"] > span[aria-hidden] img'
  );
  await expect(spinner).toBeVisible();
  await expect(spinner).toHaveCSS('width', '24px');
  await expect(spinner).toHaveCSS('height', '24px');
  await expect(spinner).toHaveCSS('animation-name', 'none');
  await expect(spinner.locator('..')).toHaveCSS('opacity', '0.7');
  await expect(page.getByText('Загрузка', { exact: true })).toBeVisible();
  await page.locator('[data-state]').screenshot({
    path: 'test-results/current-turn-loading.png',
  });
});

test('retry clears the visible error state', async ({ page }) => {
  await page.goto(
    '/?story=widgets/turn-queue/ui/CurrentTurnAnchor/ReplayError'
  );
  await expect(page.getByRole('alert')).toHaveText(
    'Не удалось загрузить историю'
  );
  await page.locator('[data-state]').screenshot({
    path: 'test-results/current-turn-error.png',
  });
  await page
    .getByRole('button', { name: 'Повторить загрузку истории' })
    .click();

  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Проиграть историю до текущего хода' })
  ).toBeAttached();
});
