import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`focuses the code field after fake email login at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      localStorage.setItem(
        'war-chest-dev-backend',
        JSON.stringify({ state: { backend: 'fake' }, version: 0 })
      );
    });
    await page.goto('/login');
    await page.getByLabel('Email').fill('archer@example.com');
    await page.getByRole('button', { name: 'Получить код' }).click();

    const code = page.getByLabel('Код из письма');
    await expect(code).toBeFocused();
    await page.keyboard.type('123456');
    await expect(code).toHaveValue('123456');

    await page.getByRole('button', { name: 'Изменить email' }).click();
    await page.getByRole('button', { name: 'Получить код' }).click();
    await expect(code).toBeFocused();
  });

  test(`preserves code focus with the real auth client at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ status: 401 })
    );
    await page.route('**/api/auth/email/code', (route) =>
      route.fulfill({
        json: {
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
          resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
        },
      })
    );
    await page.goto('/login');
    await page.getByLabel('Email').fill('archer@example.com');
    await page.getByRole('button', { name: 'Получить код' }).click();

    await expect(page.getByLabel('Код из письма')).toBeFocused();
    await page.keyboard.type('123456');
    await expect(page.getByLabel('Код из письма')).toHaveValue('123456');
  });
}
