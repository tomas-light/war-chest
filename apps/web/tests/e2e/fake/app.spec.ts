import { expect, test } from '@playwright/test';

test('keeps backend selection available when the real API is unavailable', async ({
  page,
}) => {
  await page.goto('/login');

  await expect(page.getByRole('combobox', { name: 'Бэкенд' })).toHaveValue(
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
  await expect(page.getByRole('combobox', { name: 'Бэкенд' })).toHaveValue(
    'fake'
  );
  await expect(
    page.getByRole('button', { name: 'Продолжить с Google' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Продолжить с Yandex ID' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить с Telegram' }).click();

  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.getByRole('heading', { name: 'Лобби' })).toBeVisible();
  await expect(page.getByText('T User')).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Аватар пользователя T User' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();

  await page.getByRole('button', { name: 'Dev' }).click();
  const developerPanel = page.getByRole('complementary', {
    name: 'Инструменты разработчика',
  });

  await expect(developerPanel).toBeVisible();
  await expect(
    developerPanel.getByRole('combobox', { name: 'Бэкенд' })
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
  expect(fakeAuthState.userId).toBe('10000000-0000-4000-8000-000000000002');

  await page.reload();

  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.getByText('T User')).toBeVisible();

  await page.getByRole('button', { name: 'Выйти' }).click();

  await expect(page).toHaveURL(/\/login$/);
});

test('updates the lobby and moves role selection inside a waiting game', async ({
  context,
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'war-chest-dev-backend',
      JSON.stringify({ state: { backend: 'fake' }, version: 0 })
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Продолжить с Telegram' }).click();
  await expect(page.getByRole('heading', { name: 'Лобби' })).toBeVisible();

  const secondPage = await context.newPage();
  await secondPage.goto('/');
  await secondPage.getByRole('button', { name: 'Продолжить с Google' }).click();
  await expect(
    secondPage.getByRole('heading', { name: 'Лобби' })
  ).toBeVisible();
  await expect(secondPage.getByText('Активных игр пока нет')).toBeVisible();

  await page.getByRole('button', { name: 'Новая игра' }).click();
  await page.getByRole('button', { name: 'Создать игру' }).click();

  await expect(
    page.getByRole('heading', { name: 'Как открыть игру?' })
  ).toBeVisible();

  await expect(
    secondPage.getByRole('button', { name: 'Открыть игру' })
  ).toBeVisible();
  await expect(
    secondPage.getByRole('button', { name: 'Смотреть' })
  ).toHaveCount(0);
  await expect(
    secondPage.getByRole('button', { name: 'Занять место' })
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Занять место' }).click();
  await page.getByRole('button', { name: 'Присоединиться как игрок' }).click();
  await expect(
    page.getByRole('heading', { name: 'Сменить место' })
  ).toBeVisible();

  await secondPage.getByRole('button', { name: 'Открыть игру' }).click();

  await expect(
    secondPage.getByRole('heading', { name: 'Как открыть игру?' })
  ).toBeVisible();
  await expect(
    secondPage.getByRole('button', { name: 'Смотреть' })
  ).toBeVisible();
  await expect(
    secondPage.getByRole('button', { name: 'Занять место' })
  ).toBeVisible();

  await secondPage.getByRole('button', { name: 'Занять место' }).click();
  await secondPage
    .getByRole('button', { name: 'Присоединиться как игрок' })
    .click();

  await expect(
    secondPage.getByText('Ожидаем, пока создатель запустит игру.')
  ).toBeVisible();
  await expect(
    secondPage.getByRole('button', { name: 'Запустить игру' })
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Запустить игру' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Поменять игроков местами' })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Вернуться в лобби' }).click();
  await expect(
    page.getByRole('button', { name: 'Вернуться в игру' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Вернуться в игру' }).click();

  await page.getByRole('button', { name: 'Поменять игроков местами' }).click();
  await secondPage.evaluate(() => {
    let hasShownActiveGame = false;

    sessionStorage.setItem('war-chest-preparation-returned', 'false');
    const observer = new MutationObserver(() => {
      const pageText = document.body.textContent ?? '';

      if (pageText.includes('Игровое поле')) {
        hasShownActiveGame = true;
      }

      if (hasShownActiveGame && pageText.includes('Подготовка партии')) {
        sessionStorage.setItem('war-chest-preparation-returned', 'true');
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
  await page.getByRole('button', { name: 'Запустить игру' }).click();

  await expect(page).toHaveURL(/\/games\/play\//);
  await expect(page.getByText('Игровое поле', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Доступные действия' })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'История ходов' })
  ).toBeVisible();
  await expect(secondPage).toHaveURL(/\/games\/play\//);
  await secondPage.waitForTimeout(500);
  const hasReturnedToPreparation = await secondPage.evaluate(
    () => sessionStorage.getItem('war-chest-preparation-returned') === 'true'
  );

  expect(hasReturnedToPreparation).toBe(false);

  await page.setViewportSize({ height: 844, width: 390 });
  await expect(page.getByText('Игровое поле', { exact: true })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  );

  expect(hasHorizontalOverflow).toBe(false);
});
