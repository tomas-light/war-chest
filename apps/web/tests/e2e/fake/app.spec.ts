import { expect, test } from '@playwright/test';

test('keeps backend selection available when the real API is unavailable', async ({
  page,
}) => {
  await page.goto('/login');

  await expect(page.getByRole('combobox', { name: 'Backend' })).toHaveValue(
    'real'
  );
  await expect(
    page.getByText('Не удалось связаться с сервером и проверить сессию.')
  ).toBeVisible();
});

test('signs in, restores the fake session and signs out', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'war-chest-dev-backend',
      JSON.stringify({ state: { backend: 'fake' }, version: 0 })
    );
  });

  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('combobox', { name: 'Backend' })).toHaveValue(
    'fake'
  );
  await page.getByRole('button', { name: 'Продолжить с Google' }).click();

  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.getByRole('heading', { name: 'Лобби' })).toBeVisible();
  await expect(page.getByText('G User')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();

  await page.getByRole('button', { name: 'Dev' }).click();
  const developerPanel = page.getByRole('complementary', {
    name: 'Инструменты разработчика',
  });

  await expect(developerPanel).toBeVisible();
  await expect(
    developerPanel.getByRole('combobox', { name: 'Backend' })
  ).toHaveValue('fake');
  await developerPanel.getByRole('button', { name: 'Закрыть' }).click();
  await expect(developerPanel).toBeHidden();

  const fakeAuthState = await page.evaluate(async () => {
    const sessionId = sessionStorage.getItem('war-chest-fake-auth-session-id');

    if (sessionId === null) {
      return { sessionId, userId: null };
    }

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('war-chest-fake-database');

      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () =>
        reject(request.error ?? new Error('Fake database could not be opened.'))
      );
    });
    const session = await new Promise<{ userId: string } | undefined>(
      (resolve, reject) => {
        const request = database
          .transaction('authSessions')
          .objectStore('authSessions')
          .get(sessionId);

        request.addEventListener('success', () => {
          const result: unknown = request.result;

          resolve(
            typeof result === 'object' &&
              result !== null &&
              'userId' in result &&
              typeof result.userId === 'string'
              ? { userId: result.userId }
              : undefined
          );
        });
        request.addEventListener('error', () =>
          reject(
            request.error ?? new Error('Fake auth session could not be read.')
          )
        );
      }
    );

    database.close();
    return { sessionId, userId: session?.userId ?? null };
  });

  expect(fakeAuthState.sessionId).not.toBeNull();
  expect(fakeAuthState.userId).toBe('10000000-0000-4000-8000-000000000001');

  await page.reload();

  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.getByText('G User')).toBeVisible();

  await page.getByRole('button', { name: 'Выйти' }).click();

  await expect(page).toHaveURL(/\/login$/);
});
