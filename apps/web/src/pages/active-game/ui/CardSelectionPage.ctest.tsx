import { expect, test } from '@playwright/test';

test.use({ locale: 'ru-RU' });

test('renders only the queue-era card grid without the legacy draft panels', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/StartDuelDraft'
  );

  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Выбор карт' })).toHaveCount(
    0
  );
  await expect(
    page.getByRole('button', { name: 'Лучник · Доступно' })
  ).toBeVisible();
});

test('uses the default cursor on cards while another player is choosing', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/WaitingDuelDraft'
  );
  const card = page.getByRole('button', { name: 'Лучник · Доступно' });

  await expect(card).toBeDisabled();
  await card.hover();
  await expect(card).toHaveCSS('cursor', 'default');
  await expect(card).toHaveAttribute('aria-pressed', 'false');
});

test('opens the queue step summary outside the clipped rail', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/StartDuelDraft'
  );
  const queue = page.getByRole('complementary', {
    name: 'Очередь ходов',
  });
  const step = queue.getByRole('button', {
    name: /сейчас выбирает карту/,
  });

  await step.click();

  const summary = page
    .getByRole('status')
    .filter({ hasText: /сейчас выбирает карту/ });
  await expect(summary).toBeVisible();

  const stepBounds = await step.boundingBox();
  const summaryBounds = await summary.boundingBox();

  expect(stepBounds).not.toBeNull();
  expect(summaryBounds).not.toBeNull();
  if (stepBounds !== null && summaryBounds !== null) {
    expect(summaryBounds.x).toBeGreaterThan(stepBounds.x + stepBounds.width);
  }
});

test('lets the active player change the candidate before confirmation', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/StartDuelDraft'
  );
  await page.getByRole('button', { name: 'Лучник · Доступно' }).click();
  await page
    .getByRole('button', { name: 'Кавалерия · Доступно', exact: true })
    .click();

  await expect(
    page.getByRole('button', { name: 'Лучник · Доступно' })
  ).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('button', { name: 'Кавалерия · К подтверждению' })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: 'Подтвердить выбор' })
  ).toBeEnabled();
});

test('toggles a card and clears the candidate only when clicking outside the cards', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/StartDuelDraft'
  );

  const archer = page.getByRole('button', { name: 'Лучник · Доступно' });

  await archer.click();
  await expect(
    page.getByRole('button', { name: 'Лучник · К подтверждению' })
  ).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Лучник · К подтверждению' }).click();
  await expect(archer).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('button', { name: 'Подтвердить выбор' })
  ).toHaveCount(0);

  await archer.click();
  await page.locator('main').click({ position: { x: 1, y: 1 } });
  await expect(archer).toHaveAttribute('aria-pressed', 'false');

  await archer.click();
  await page
    .getByRole('button', { name: 'Кавалерия · Доступно', exact: true })
    .click();
  await expect(archer).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('button', { name: 'Кавалерия · К подтверждению' })
  ).toHaveAttribute('aria-pressed', 'true');

  const confirmButton = page.getByRole('button', {
    name: 'Подтвердить выбор',
  });

  await confirmButton.dispatchEvent('pointerdown');
  await expect(confirmButton).toBeEnabled();
});

test('changes the card frame independently from its artwork', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/StartDuelDraft'
  );

  const card = page.getByRole('button', { name: 'Лучник · Доступно' });
  const frame = card.locator('span').last();

  await expect(frame).toHaveCSS('background-image', /%23C79635/);
  await card.click();
  await page.mouse.move(0, 0);

  const candidateCard = page.getByRole('button', {
    name: 'Лучник · К подтверждению',
  });

  await expect(candidateCard.locator('span').last()).toHaveCSS(
    'background-image',
    /%2315D9ED/
  );
  await expect(candidateCard.locator('img:visible')).toHaveAttribute(
    'src',
    /unitCards\.ru\.webp/
  );
  await expect(candidateCard.locator('span').first()).toHaveCSS(
    'mask-image',
    'none'
  );
});

test('shows future draft steps only through the next turn of the current player', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/StartDuelDraft'
  );

  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });

  await expect(queue.getByRole('listitem')).toHaveCount(4);
});

test('keeps revealed future avatars when the opponent has consecutive draft picks', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/AdvancingDuelDraft'
  );

  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const steps = queue.getByRole('listitem');
  const advanceButton = page.getByRole('button', { name: 'Следующий выбор' });

  await expect(steps).toHaveCount(4);
  await expect(steps.nth(3).getByRole('button')).toHaveAttribute(
    'aria-label',
    /ux user/
  );

  await advanceButton.click();

  await expect(steps).toHaveCount(4);
  await expect(steps.nth(1)).toHaveAttribute('data-state', 'current');
  await expect(steps.nth(2)).toHaveAttribute('data-state', 'upcoming');
  await expect(steps.nth(3).getByRole('button')).toHaveAttribute(
    'aria-label',
    /ux user/
  );

  await advanceButton.click();

  await expect(steps).toHaveCount(6);
  await expect(steps.nth(3).getByRole('button')).toHaveAttribute(
    'aria-label',
    /ux user/
  );
});

test('keeps the ban confirmation inside the selected card', async ({
  page,
}) => {
  await page.goto('/?story=pages/active-game/ui/CardSelectionPage/DuelBan');

  await expect(
    page.getByRole('button', { name: 'Подтвердить бан' })
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Лучник · Доступно' }).click();
  const confirmButton = page.getByRole('button', { name: 'Подтвердить бан' });
  const candidateCard = page.getByRole('button', {
    name: 'Лучник · К подтверждению',
  });

  await expect(confirmButton).toBeEnabled();
  await expect(candidateCard.locator('span').last()).toHaveCSS(
    'background-image',
    /%2315D9ED/
  );
  await expect(confirmButton).toHaveCSS('border-color', 'rgb(255, 59, 66)');

  const buttonBounds = await confirmButton.boundingBox();
  const iconBounds = await confirmButton.locator('img').boundingBox();

  expect(buttonBounds).not.toBeNull();
  expect(iconBounds).not.toBeNull();
  if (buttonBounds !== null && iconBounds !== null) {
    expect(iconBounds.x + iconBounds.width / 2).toBeCloseTo(
      buttonBounds.x + buttonBounds.width / 2,
      1
    );
    expect(iconBounds.y + iconBounds.height / 2).toBeCloseTo(
      buttonBounds.y + buttonBounds.height / 2,
      1
    );
  }

  await confirmButton.hover();
  await expect(confirmButton).toHaveCSS('background-color', 'rgb(23, 32, 35)');
});

test('disables all card choices while reconnecting', async ({ page }) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/DisconnectedTeamDraft'
  );

  await expect(
    page.getByRole('button', { name: 'Лучник · Доступно' })
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Подтвердить выбор' })
  ).toHaveCount(0);
});

test('resumes completed selections without a separate confirmation action', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/CompleteTeamDraft'
  );

  await expect(page.getByRole('status')).toHaveText(
    'Завершаем выбор и открываем игровой стол…'
  );
  await expect(
    page.getByRole('button', { name: 'Подтвердить выбор' })
  ).toHaveCount(0);
});

test('shows the confirmed owner above dimmed picked artwork', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/ReverseTeamDraft'
  );
  const pickedCard = page
    .getByRole('button', {
      name: / · Выбрано/,
    })
    .first();
  const container = pickedCard.locator('..');

  await expect(pickedCard.locator('span').first()).toHaveCSS('opacity', '0.45');
  await expect(
    container.getByRole('img', { name: /Аватар пользователя/ })
  ).toBeVisible();
});

for (const story of ['LastManualDuelPick', 'LastManualTeamPick']) {
  test(`${story} keeps the final confirmation inside the selected card`, async ({
    page,
  }) => {
    await page.goto(`/?story=pages/active-game/ui/CardSelectionPage/${story}`);
    await expect(
      page.getByRole('button', { name: / · Доступно$/ })
    ).toHaveCount(2);
    await page
      .getByRole('button', { name: / · Доступно$/ })
      .first()
      .click();
    await expect(
      page.getByRole('button', { name: 'Подтвердить выбор' })
    ).toBeEnabled();
  });
}

test('preserves a visible keyboard focus on selectable cards', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/StartDuelDraft'
  );
  const card = page.getByRole('button', { name: 'Лучник · Доступно' });

  await expect(card).toBeVisible();
  await card.focus();
  await expect(card).toBeFocused();
  await expect(card).toHaveCSS('outline-style', 'solid');
});

test('uses the compact Figma card artwork and dimensions on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/StartDuelDraft'
  );
  const card = page.getByRole('button', { name: 'Лучник · Доступно' });

  await expect(card).toHaveCSS('width', '131px');
  await expect(card).toHaveCSS('height', '174px');
  await expect(card.locator('img:visible')).toHaveCount(1);
  await expect(card.locator('img:visible')).toHaveAttribute(
    'src',
    /unitCardsCompact\.ru\.webp/
  );
});

test('uses the English compact artwork on mobile when the interface is in English', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.addInitScript(() => {
    window.localStorage.setItem('war-chest-language', 'en');
  });
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/StartDuelDraft'
  );

  const card = page.getByRole('button', { name: 'Archer · Available' });

  await expect(card).toHaveCSS('width', '131px');
  await expect(card.locator('img:visible')).toHaveCount(1);
  await expect(card.locator('img:visible')).toHaveAttribute(
    'src',
    /unitCardsCompact\.en\.webp/
  );

  await page.setViewportSize({ height: 900, width: 1440 });

  await expect(card.locator('img:visible')).toHaveAttribute(
    'src',
    /unitCards\.en\.webp/
  );
});

for (const width of [320, 390, 1440]) {
  for (const story of [
    'StartDuelDraft',
    'StartTeamDraft',
    'TeamBan',
    'LastManualTeamPick',
  ]) {
    test(`${story} fits the ${width}px viewport without horizontal overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: 900, width });
      await page.goto(
        `/?story=pages/active-game/ui/CardSelectionPage/${story}`
      );
      await expect(
        page.getByRole('button', { name: / · Доступно$/ }).first()
      ).toBeVisible();
      const overflow = await page
        .locator('main')
        .evaluate((element) => element.scrollWidth > element.clientWidth);

      expect(overflow).toBe(false);
    });
  }
}
