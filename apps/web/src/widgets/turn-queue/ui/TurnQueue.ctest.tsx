import { expect, test } from '@playwright/test';

test.use({ locale: 'ru-RU' });

test('keeps the lower arrow disabled when all eight avatars fit', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/LastManualDuelPick'
  );
  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const viewport = queue.getByRole('list');

  await expect(viewport.getByRole('listitem')).toHaveCount(8);
  expect(
    await viewport.evaluate(
      (element) => element.scrollHeight <= element.clientHeight
    )
  ).toBe(true);
  await expect(
    queue.getByRole('button', { name: 'Прокрутить ленту вниз' })
  ).toBeDisabled();
  await queue.screenshot({ path: 'test-results/turn-queue-all-visible.png' });
});

test('scrolls down through the lower arrow with mouse and keyboard', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/CompleteTeamElimination'
  );
  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const viewport = queue.getByRole('list');
  const down = queue.getByRole('button', { name: 'Прокрутить ленту вниз' });

  await expect(down).toBeEnabled();
  await down.hover();
  await expect(down).toHaveCSS('cursor', 'pointer');
  await down.click();
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBe(62);
  await down.focus();
  await page.keyboard.press('Enter');
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBe(124);

  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(down).toBeDisabled();
  await expect(down).toHaveCSS('cursor', 'default');
});

test('updates the scroll boundary when the viewport height changes', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/LastManualDuelPick'
  );
  const down = page.getByRole('button', { name: 'Прокрутить ленту вниз' });

  await expect(down).toBeDisabled();
  await page.setViewportSize({ width: 1440, height: 500 });
  await expect(down).toBeEnabled();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(down).toBeDisabled();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(down).toBeEnabled();
  await page.getByRole('complementary', { name: 'Очередь ходов' }).screenshot({
    path: 'test-results/turn-queue-mobile-scroll.png',
  });
});

test('moves the rail with a mouse drag and keeps capture outside its bounds', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/CompleteTeamElimination'
  );
  const viewport = page
    .getByRole('complementary', { name: 'Очередь ходов' })
    .getByRole('list');
  const bounds = await viewport.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) {
    return;
  }

  const startX = bounds.x + bounds.width / 2;
  const startY = bounds.y + 170;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY - 100, { steps: 10 });
  await expect(viewport).toHaveCSS('cursor', 'grabbing');
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBe(100);
  await page.mouse.move(bounds.x + bounds.width + 100, startY - 60, {
    steps: 5,
  });
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBe(60);
  await page.mouse.up();
  await expect(viewport).toHaveCSS('cursor', 'grab');
});

test('does not activate an avatar after dragging but still opens it on a click', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/CompleteTeamElimination'
  );
  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const avatar = queue.getByRole('listitem').nth(2).getByRole('button');
  const bounds = await avatar.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) {
    return;
  }

  const startX = bounds.x + bounds.width / 2;
  const startY = bounds.y + bounds.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY - 80, { steps: 8 });
  await page.mouse.up();
  await expect(avatar).toHaveAttribute('aria-expanded', 'false');

  const visibleAvatar = queue.getByRole('listitem').first().getByRole('button');
  const summary = await visibleAvatar.getAttribute('aria-label');
  expect(summary).not.toBeNull();
  await visibleAvatar.click();
  await expect(visibleAvatar).toHaveAttribute('aria-expanded', 'true');
  if (summary !== null) {
    await expect(
      page.getByRole('status').filter({ hasText: summary })
    ).toBeVisible();
  }
});

test('preserves native vertical touch scrolling', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    locale: 'ru-RU',
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(
    'http://127.0.0.1:5174/?story=pages/active-game/ui/CardSelectionPage/CompleteTeamElimination'
  );
  const viewport = page
    .getByRole('complementary', { name: 'Очередь ходов' })
    .getByRole('list');
  const bounds = await viewport.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) {
    await context.close();
    return;
  }

  const session = await context.newCDPSession(page);
  const startX = bounds.x + bounds.width / 2;
  const startY = bounds.y + 240;
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }],
  });
  for (const distance of [30, 60, 90, 120, 150]) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX, y: startY - distance }],
    });
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await expect(viewport).toHaveCSS('cursor', 'grab');
  await context.close();
});
