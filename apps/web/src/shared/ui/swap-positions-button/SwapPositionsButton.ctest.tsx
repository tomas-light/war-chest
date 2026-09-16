import { expect, test } from '@playwright/test';

test('matches the compact Figma control dimensions', async ({ page }) => {
  await page.goto(
    '/?story=shared/ui/swap-positions-button/SwapPositionsButton/Default'
  );

  const button = page.getByRole('button', {
    name: 'Поменять игроков местами',
  });
  const buttonBounds = await button.boundingBox();
  const iconBounds = await button.locator('img').boundingBox();

  expect(buttonBounds).not.toBeNull();
  expect(iconBounds).not.toBeNull();
  if (buttonBounds !== null && iconBounds !== null) {
    expect(buttonBounds.width).toBe(38);
    expect(buttonBounds.height).toBe(38);
    expect(iconBounds.width).toBe(19);
    expect(iconBounds.height).toBe(19);
    expect(iconBounds.x + iconBounds.width / 2).toBe(
      buttonBounds.x + buttonBounds.width / 2
    );
    expect(iconBounds.y + iconBounds.height / 2).toBe(
      buttonBounds.y + buttonBounds.height / 2
    );
  }
});

test('keeps a 44px mobile touch target around the same control', async ({
  page,
}) => {
  await page.goto(
    '/?story=shared/ui/swap-positions-button/SwapPositionsButton/MobileTouchTarget'
  );

  const buttonBounds = await page
    .getByRole('button', { name: 'Показать другого игрока команды' })
    .boundingBox();

  expect(buttonBounds).not.toBeNull();
  if (buttonBounds !== null) {
    expect(buttonBounds.width).toBe(44);
    expect(buttonBounds.height).toBe(44);
  }
});

test('exposes the disabled state', async ({ page }) => {
  await page.goto(
    '/?story=shared/ui/swap-positions-button/SwapPositionsButton/Disabled'
  );

  await expect(
    page.getByRole('button', { name: 'Поменять игроков местами' })
  ).toBeDisabled();
});
