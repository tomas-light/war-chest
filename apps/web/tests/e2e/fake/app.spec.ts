import { type Page, expect, test } from '@playwright/test';

const ARCHER_EMAIL = 'archer@example.com';
const CAVALRY_EMAIL = 'cavalry@example.com';
const WARRIOR_PRIEST_EMAIL = 'priest@example.com';

test('keeps backend selection available when the real API is unavailable', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
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
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByText('Используйте код 123456')).toBeVisible();
  await signIn(page, CAVALRY_EMAIL);

  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.getByRole('heading', { name: 'Лобби' })).toBeVisible();
  await expect(page.getByText('Cavalry')).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Аватар пользователя Cavalry' })
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
  const featureFlags = developerPanel.getByRole('list');

  await expect(
    featureFlags.getByRole('listitem').filter({ hasText: 'game history' })
  ).toContainText('Включён');
  await expect(
    featureFlags.getByRole('listitem').filter({ hasText: 'optimistic moves' })
  ).toContainText('Выключен');
  await expect(
    featureFlags.getByRole('listitem').filter({ hasText: 'spectator mode' })
  ).toContainText('Включён');

  await page.mouse.click(16, 220);
  await expect(developerPanel).toBeHidden();

  await page.getByRole('button', { name: 'Dev' }).click();
  await expect(developerPanel).toBeVisible();
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
  await expect(page.getByText('Cavalry')).toBeVisible();

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
  await signIn(page, CAVALRY_EMAIL);
  await expect(page.getByRole('heading', { name: 'Лобби' })).toBeVisible();

  const secondPage = await context.newPage();
  await secondPage.goto('/');
  await signIn(secondPage, ARCHER_EMAIL);
  await expect(
    secondPage.getByRole('heading', { name: 'Лобби' })
  ).toBeVisible();
  await expect(secondPage.getByText('Активных игр пока нет')).toBeVisible();

  await page.getByRole('button', { name: 'Новая игра' }).click();
  await page.getByRole('button', { name: 'Создать игру' }).click();

  await expect(
    page.getByRole('button', { name: 'Выберите свободное место' })
  ).toBeDisabled();

  await expect(
    secondPage.getByRole('button', { name: 'Открыть игру' })
  ).toBeVisible();
  await expect(
    secondPage.getByRole('button', { name: 'Смотреть' })
  ).toHaveCount(0);
  await expect(
    secondPage.getByRole('button', { name: 'Занять место' })
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Занять место' }).first().click();

  await secondPage.getByRole('button', { name: 'Открыть игру' }).click();

  await expect(
    secondPage.getByRole('button', { name: 'Выберите свободное место' })
  ).toBeDisabled();
  await expect(
    secondPage.getByRole('button', { name: 'Смотреть' })
  ).toBeVisible();
  await expect(
    secondPage.getByRole('button', { name: 'Занять место' })
  ).toBeVisible();

  await secondPage.getByRole('button', { name: 'Занять место' }).click();

  await expect(
    secondPage.getByRole('button', { name: 'Ожидаем запуска игры' })
  ).toBeDisabled();
  await expect(
    secondPage.getByRole('button', { name: 'Запустить игру' })
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Запустить игру' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Поменять игроков местами' })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Назад в лобби' }).click();
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
  await expect(
    page.getByRole('region', { name: 'Игровое поле' })
  ).toBeVisible();
  await expect(
    page.getByRole('complementary', { name: 'Очередь ходов' })
  ).toBeVisible();
  await expect(secondPage).toHaveURL(/\/games\/play\//);
  await expect(page.getByRole('button', { name: 'Сдаться' })).toBeVisible();
  await expect(
    secondPage.getByRole('button', { name: 'Сдаться' })
  ).toBeVisible();
  await secondPage.waitForTimeout(500);
  const hasReturnedToPreparation = await secondPage.evaluate(
    () => sessionStorage.getItem('war-chest-preparation-returned') === 'true'
  );

  expect(hasReturnedToPreparation).toBe(false);

  const turnQueue = secondPage.getByRole('complementary', {
    name: 'Очередь ходов',
  });

  await expect(turnQueue.locator('li')).toHaveCount(10);
  await expect(
    turnQueue.locator('li').first().getByRole('button')
  ).toHaveAccessibleName('Сейчас ходит Archer');

  await startBlankScreenMonitor(secondPage);
  await secondPage
    .getByRole('button', { name: /^Жетон / })
    .first()
    .click();
  await expectNoBlankScreen(secondPage);
  await secondPage.getByRole('button', { name: 'Пас', exact: true }).click();

  await expect(turnQueue.locator('li')).toHaveCount(11);
  await expect(
    turnQueue.locator('li').first().getByRole('button')
  ).toHaveAccessibleName('Archer спасовал');

  await page.getByRole('button', { name: 'Сдаться' }).click();
  await expect(page.getByRole('heading', { name: 'Вы сдались' })).toBeVisible();
  await expect(
    secondPage.getByRole('heading', { name: 'Оппонент сдался' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сдаться' })).toHaveCount(0);
  await expect(secondPage.getByRole('button', { name: 'Сдаться' })).toHaveCount(
    0
  );
  await Promise.all([page.reload(), secondPage.reload()]);
  await expect(page.getByRole('heading', { name: 'Вы сдались' })).toBeVisible();
  await expect(
    secondPage.getByRole('heading', { name: 'Оппонент сдался' })
  ).toBeVisible();
  const finishedGameTable = page.getByRole('region', {
    name: 'Игровое поле',
  });
  const secondFinishedGameTable = secondPage.getByRole('region', {
    name: 'Игровое поле',
  });

  await expect(
    finishedGameTable.getByRole('img', {
      name: 'Аватар пользователя Cavalry',
    })
  ).toBeVisible();
  await expect(
    finishedGameTable.getByRole('img', {
      name: 'Аватар пользователя Archer',
    })
  ).toBeVisible();
  await expect(
    secondFinishedGameTable.getByRole('img', {
      name: 'Аватар пользователя Cavalry',
    })
  ).toBeVisible();
  await expect(
    secondFinishedGameTable.getByRole('img', {
      name: 'Аватар пользователя Archer',
    })
  ).toBeVisible();

  const finishedGameUrl = page.url();

  await finishedGameTable
    .getByRole('link', { name: 'Открыть профиль игрока Archer' })
    .click();
  await expect(page).toHaveURL(
    /\/users\/10000000-0000-4000-8000-000000000001$/
  );
  await expect(page.getByRole('heading', { name: 'Archer' })).toBeVisible();

  await page.getByRole('link', { name: 'Открыть историю игр' }).click();
  await expect(page).toHaveURL(
    /\/users\/10000000-0000-4000-8000-000000000001\/history$/
  );
  await expect(
    page.getByRole('heading', { name: 'История игр: Archer' })
  ).toBeVisible();
  await expect(page.getByText('Победа', { exact: true })).toBeVisible();

  await page
    .getByRole('link', { name: 'Открыть профиль игрока Cavalry' })
    .click();
  await expect(page).toHaveURL(
    /\/users\/10000000-0000-4000-8000-000000000002$/
  );
  await expect(page.getByRole('heading', { name: 'Cavalry' })).toBeVisible();

  await page.getByRole('link', { name: 'Открыть историю игр' }).click();
  await expect(page.getByText('Поражение', { exact: true })).toBeVisible();
  await page.setViewportSize({ height: 844, width: 390 });
  const hasHistoryHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  );

  expect(hasHistoryHorizontalOverflow).toBe(false);
  await page.getByRole('link', { name: 'Открыть игру' }).click();
  await expect(page).toHaveURL(/\/history\//);
  await expect(
    page.getByRole('heading', { name: 'История игры' })
  ).toBeVisible();

  await page.goto(finishedGameUrl);
  await expect(page.getByRole('heading', { name: 'Вы сдались' })).toBeVisible();

  const spectatorPage = await context.newPage();

  await spectatorPage.goto('/');
  await signIn(spectatorPage, WARRIOR_PRIEST_EMAIL);
  await expect(
    spectatorPage.getByRole('heading', { name: 'Лобби' })
  ).toBeVisible();
  await spectatorPage.goto(finishedGameUrl);
  await expect(
    spectatorPage.getByRole('heading', { name: 'Победитель: Archer' })
  ).toBeVisible();
  await expect(
    spectatorPage.getByRole('button', { name: 'Сдаться' })
  ).toHaveCount(0);
  await expect(
    spectatorPage.getByRole('complementary', { name: 'Очередь ходов' })
  ).toHaveCount(0);

  await page.setViewportSize({ height: 844, width: 390 });
  await expect(
    page.getByRole('region', { name: 'Игровое поле' })
  ).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth
  );

  expect(hasHorizontalOverflow).toBe(false);
});

test('lets a non-current player surrender during card selection', async ({
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
  await signIn(page, CAVALRY_EMAIL);

  const secondPage = await context.newPage();
  await secondPage.goto('/');
  await signIn(secondPage, ARCHER_EMAIL);

  await page.getByRole('button', { name: 'Новая игра' }).click();
  await page.getByRole('button', { name: 'Создать игру' }).click();
  await page.getByRole('button', { name: 'Занять место' }).first().click();

  const draftOption = page.getByRole('radio', {
    name: /Draft Игроки по очереди выбирают карты/,
  });

  await draftOption.click();
  await expect(draftOption).toBeChecked();

  await secondPage.getByRole('button', { name: 'Открыть игру' }).click();
  await secondPage.getByRole('button', { name: 'Занять место' }).click();
  await page.getByRole('button', { name: 'Запустить игру' }).click();

  await expect(page.getByRole('heading', { name: 'Выбор карт' })).toBeVisible();
  const currentSelectionButton = page.getByRole('button', {
    name: /сейчас выбирает карту$/,
  });

  await expect(currentSelectionButton).toBeVisible();
  const currentSelectionLabel =
    await currentSelectionButton.getAttribute('aria-label');
  let currentPlayerPage: Page = secondPage;
  let nonCurrentPlayerPage: Page = page;

  if (currentSelectionLabel?.startsWith('Cavalry')) {
    currentPlayerPage = page;
    nonCurrentPlayerPage = secondPage;
  }

  await startBlankScreenMonitor(currentPlayerPage);
  await currentPlayerPage
    .getByRole('button', { name: / · Доступно$/ })
    .first()
    .click();
  await expect(
    currentPlayerPage.getByRole('button', { name: 'Подтвердить выбор' })
  ).toBeVisible();
  await expectNoBlankScreen(currentPlayerPage);

  await nonCurrentPlayerPage.getByRole('button', { name: 'Сдаться' }).click();

  await expect(
    nonCurrentPlayerPage.getByRole('heading', { name: 'Вы сдались' })
  ).toBeVisible();
  await expect(
    currentPlayerPage.getByRole('heading', { name: 'Оппонент сдался' })
  ).toBeVisible();
  await expect(
    nonCurrentPlayerPage.getByText('Команда отклонена правилами игры.')
  ).toHaveCount(0);
});

test('lets a player leave and the creator close a waiting lobby', async ({
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
  await signIn(page, CAVALRY_EMAIL);
  await page.getByRole('button', { name: 'Новая игра' }).click();
  await page.getByRole('button', { name: 'Создать игру' }).click();
  await expect(
    page.getByRole('button', { name: 'Закрыть лобби' })
  ).toBeVisible();

  const secondPage = await context.newPage();
  await secondPage.goto('/');
  await signIn(secondPage, ARCHER_EMAIL);
  await secondPage.getByRole('button', { name: 'Открыть игру' }).click();
  await secondPage
    .getByRole('button', { name: 'Занять место' })
    .first()
    .click();

  await secondPage.getByRole('button', { name: 'Покинуть лобби' }).click();

  await expect(secondPage).toHaveURL(/\/lobby$/);
  await expect(
    page.locator('article').filter({ hasText: 'Свободно' })
  ).toHaveCount(2);

  await secondPage.getByRole('button', { name: 'Открыть игру' }).click();
  await secondPage
    .getByRole('button', { name: 'Занять место' })
    .first()
    .click();

  await page.evaluate(() => {
    sessionStorage.setItem('war-chest-close-showed-game-error', 'false');
    const observer = new MutationObserver(() => {
      const pageText = document.body.textContent ?? '';

      if (
        pageText.includes('Игра не найдена') ||
        pageText.includes('Не удалось открыть игру')
      ) {
        sessionStorage.setItem('war-chest-close-showed-game-error', 'true');
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });

  await page.getByRole('button', { name: 'Закрыть лобби' }).click();

  await expect(page).toHaveURL(/\/lobby$/);
  await expect(page.getByText('Активных игр пока нет')).toBeVisible();
  const hasShownGameError = await page.evaluate(
    () => sessionStorage.getItem('war-chest-close-showed-game-error') === 'true'
  );

  expect(hasShownGameError).toBe(false);
  await expect(
    secondPage.getByRole('heading', { name: 'Не удалось открыть игру' })
  ).toBeVisible();
});

async function signIn(page: Page, email: string): Promise<void> {
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из письма').fill('123456');
  await page.getByRole('button', { name: 'Войти' }).click();
}

async function startBlankScreenMonitor(page: Page): Promise<void> {
  await page.evaluate(() => {
    sessionStorage.setItem('war-chest-blank-screen-shown', 'false');
    const root = document.querySelector('#root');

    if (root === null) {
      throw new Error('Application root was not found.');
    }

    const observer = new MutationObserver(() => {
      if (root.childElementCount === 0) {
        sessionStorage.setItem('war-chest-blank-screen-shown', 'true');
      }
    });

    observer.observe(root, { childList: true });
  });
}

async function expectNoBlankScreen(page: Page): Promise<void> {
  const hasShownBlankScreen = await page.evaluate(
    () => sessionStorage.getItem('war-chest-blank-screen-shown') === 'true'
  );

  expect(hasShownBlankScreen).toBe(false);
}
