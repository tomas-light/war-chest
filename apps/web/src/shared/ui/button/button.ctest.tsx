import { expect, test } from '@playwright/test';

test('renders the primary action', async ({ page }) => {
  await page.goto('/?story=shared/ui/button/Button/Primary');

  await expect(page.getByRole('button', { name: 'Начать игру' })).toBeVisible();
});

test('prevents interaction with the disabled action', async ({ page }) => {
  await page.goto('/?story=shared/ui/button/Button/Disabled');

  await expect(
    page.getByRole('button', { name: 'Начать игру' })
  ).toBeDisabled();
});
