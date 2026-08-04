import { expect, test } from '@playwright/test';

test('opens the lobby through the application entry route', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'war-chest-dev-backend',
      JSON.stringify({ state: { backend: 'fake' }, version: 0 })
    );
  });

  await page.goto('/');

  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.getByRole('heading', { name: 'Лобби' })).toBeVisible();
});
