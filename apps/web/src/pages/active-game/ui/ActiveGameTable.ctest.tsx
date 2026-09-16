import { expect, test } from '@playwright/test';

test.use({ locale: 'ru-RU' });

test('renders all duel cells and keeps the white edge at the white player', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelWhitePlayer'
  );

  await expect(page.getByRole('gridcell')).toHaveCount(37);
  await expect(
    page.locator('[role="gridcell"][data-kind="ground"]')
  ).toHaveCount(27);
  await expect(
    page.locator('[role="gridcell"][data-kind="controlPoint"]')
  ).toHaveCount(10);
  const whiteEdge = await page
    .getByRole('gridcell', { name: 'Клетка A1' })
    .boundingBox();
  const blackEdge = await page
    .getByRole('gridcell', { name: 'Клетка G7' })
    .boundingBox();

  expect(whiteEdge).not.toBeNull();
  expect(blackEdge).not.toBeNull();
  if (whiteEdge !== null && blackEdge !== null) {
    expect(whiteEdge.y).toBeGreaterThan(blackEdge.y);
  }
});

test('rotates canonical cells for the black player without changing cell ids', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelWhitePlayer'
  );

  const whiteA1 = await page
    .getByRole('gridcell', { name: 'Клетка A1' })
    .boundingBox();
  const whiteD4 = await page
    .getByRole('gridcell', { name: 'Клетка D4' })
    .boundingBox();
  const whiteG7 = await page
    .getByRole('gridcell', { name: 'Клетка G7' })
    .boundingBox();

  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelBlackPlayer'
  );

  const blackA1 = await page
    .getByRole('gridcell', { name: 'Клетка A1' })
    .boundingBox();
  const blackD4 = await page
    .getByRole('gridcell', { name: 'Клетка D4' })
    .boundingBox();
  const blackG7 = await page
    .getByRole('gridcell', { name: 'Клетка G7' })
    .boundingBox();

  expect(whiteA1).not.toBeNull();
  expect(whiteD4).not.toBeNull();
  expect(whiteG7).not.toBeNull();
  expect(blackA1).not.toBeNull();
  expect(blackD4).not.toBeNull();
  expect(blackG7).not.toBeNull();
  if (
    whiteA1 !== null &&
    whiteD4 !== null &&
    whiteG7 !== null &&
    blackA1 !== null &&
    blackD4 !== null &&
    blackG7 !== null
  ) {
    expect(blackA1.x).toBeCloseTo(whiteG7.x, 2);
    expect(blackA1.y).toBeCloseTo(whiteG7.y, 2);
    expect(blackD4.x).toBeCloseTo(whiteD4.x, 2);
    expect(blackD4.y).toBeCloseTo(whiteD4.y, 2);
    expect(blackG7.x).toBeCloseTo(whiteA1.x, 2);
    expect(blackG7.y).toBeCloseTo(whiteA1.y, 2);
    expect(blackG7.y).toBeGreaterThan(blackA1.y);
  }
});

test('renders the complete team layout and mobile teammate switches', async ({
  page,
}) => {
  await page.setViewportSize({ height: 1200, width: 390 });
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/TeamWhitePlayer'
  );

  await expect(page.getByRole('gridcell')).toHaveCount(47);
  await expect(
    page.locator('[role="gridcell"][data-kind="ground"]')
  ).toHaveCount(33);
  await expect(
    page.locator('[role="gridcell"][data-kind="controlPoint"]')
  ).toHaveCount(14);
  await expect(page.locator('[role="gridcell"][data-zone="team"]')).toHaveCount(
    8
  );
  await expect(
    page.locator('[role="gridcell"][data-kind="ground"][data-zone="team"]')
  ).toHaveCount(6);
  const switchButtons = page.getByRole('button', {
    name: 'Показать другого игрока команды',
  });

  await expect(switchButtons).toHaveCount(2);
  const switchButtonBounds = await switchButtons.first().boundingBox();
  expect(switchButtonBounds).not.toBeNull();
  if (switchButtonBounds !== null) {
    expect(switchButtonBounds.width).toBe(44);
    expect(switchButtonBounds.height).toBe(44);
  }

  await switchButtons.first().click();
  await expect(page.getByText('Дмитрий')).toBeVisible();
});
