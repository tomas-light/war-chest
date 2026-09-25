import { expect, test } from '@playwright/test';

test.use({ locale: 'ru-RU' });

test('requires a coin before passing and exposes the Royal Coin', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameSidebar/CurrentPlayerPass'
  );

  const passButton = page.getByRole('button', { name: 'Пас', exact: true });
  const royalCoin = page.getByRole('button', {
    name: /Королевский жетон/,
  });

  await expect(passButton).toBeDisabled();
  await royalCoin.click();
  await expect(royalCoin).toHaveAttribute('aria-pressed', 'true');
  await expect(passButton).toBeEnabled();
});

test('fits the pass action into a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ height: 800, width: 320 });
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameSidebar/CurrentPlayerPass'
  );

  await expect(
    page.getByRole('heading', { name: /Доступные действия/ })
  ).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
});
