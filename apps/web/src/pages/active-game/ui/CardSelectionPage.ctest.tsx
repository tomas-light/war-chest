import { expect, test } from '@playwright/test';

test.use({ locale: 'ru-RU' });

test('keeps fallback avatar initials centered inside the player identity', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/StartDuelDraft'
  );
  const avatar = page.getByRole('img', { name: 'Аватар пользователя ux user' });
  await expect(avatar).toHaveCSS('display', 'grid');
  await expect(avatar).toHaveCSS('place-items', 'center');
  await expect(avatar).toHaveCSS('font-size', '10px');
  const avatarBounds = await avatar.boundingBox();
  const initialsBounds = await avatar.locator('span').boundingBox();
  expect(avatarBounds).not.toBeNull();
  expect(initialsBounds).not.toBeNull();
  if (avatarBounds !== null && initialsBounds !== null) {
    expect(
      Math.abs(
        initialsBounds.y +
          initialsBounds.height / 2 -
          avatarBounds.y -
          avatarBounds.height / 2
      )
    ).toBeLessThan(1);
  }
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

test('shows four empty selected-card slots per player in a duel', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/StartDuelDraft'
  );
  await expect(page.getByRole('article')).toHaveCount(2);
  await expect(
    page.getByRole('article').first().getByText('Не выбрано', { exact: true })
  ).toHaveCount(4);
  await expect(
    page.getByRole('article').last().getByText('Не выбрано', { exact: true })
  ).toHaveCount(4);
});

test('shows the separate ban slot and ban action in elimination draft', async ({
  page,
}) => {
  await page.goto('/?story=pages/active-game/ui/CardSelectionPage/DuelBan');
  await expect(page.getByText('Бан · 0/1', { exact: true })).toHaveCount(2);
  await expect(
    page.getByRole('button', { name: 'Выберите карту для бана' })
  ).toBeDisabled();
});

test('disables all card choices while reconnecting', async ({ page }) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/DisconnectedTeamDraft'
  );
  await expect(
    page.getByRole('button', { name: 'Лучник · Доступно' })
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Выберите карту' })
  ).toBeDisabled();
});

test('uses the reverse-round hint for the actual current player', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/ReverseTeamDraft'
  );
  await expect(page.getByRole('status')).toContainText(
    '← Обратный круг · ход 6/12 · выбирает игрок 3'
  );
  await expect(
    page.getByText('Следующий ход: игрок 2 · fe user')
  ).toBeVisible();
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
  await expect(page.getByRole('button')).toHaveCount(0);
});

test('removes the inner frame from picked portraits while keeping empty-slot frames', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/ReverseTeamDraft'
  );
  const player = page.getByRole('article').first();
  const pickedSlot = player.getByText('Лучник', { exact: true }).locator('..');
  const pickedArtwork = pickedSlot.locator(':scope > span').first();
  const emptyArtwork = player
    .getByText('Не выбрано', { exact: true })
    .first()
    .locator('..')
    .locator(':scope > span')
    .first();
  await expect(pickedArtwork).toHaveCSS('border-width', '0px');
  await expect(pickedArtwork).toHaveCSS('border-radius', '0px');
  await expect(pickedSlot).toHaveCSS('border-width', '1px');
  await expect(emptyArtwork).toHaveCSS('border-width', '1px');
});

for (const story of ['LastManualDuelPick', 'LastManualTeamPick']) {
  test(`${story} explains that confirming the penultimate card opens the table`, async ({
    page,
  }) => {
    await page.goto(`/?story=pages/active-game/ui/CardSelectionPage/${story}`);
    await expect(
      page
        .getByText(
          'Оставшаяся карта выдаётся автоматически — сразу после подтверждения откроется игровой стол.'
        )
        .last()
    ).toBeVisible();
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
  await page.keyboard.press('Tab');
  await expect(card).toBeFocused();
  await expect(card).toHaveCSS('outline-style', 'solid');
});

test('uses the compact Figma card artwork on mobile', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(
    '/?story=pages/active-game/ui/CardSelectionPage/StartDuelDraft'
  );
  const card = page.getByRole('button', { name: 'Лучник · Доступно' });
  await expect(card.locator('img:visible')).toHaveCount(1);
  await expect(card.locator('img:visible')).toHaveAttribute(
    'src',
    /unitCardsCompact\.ru\.webp/
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
        page.getByRole('heading', { name: 'Выбор карт' })
      ).toBeVisible();
      const overflow = await page
        .locator('main')
        .evaluate((element) => element.scrollWidth > element.clientWidth);
      expect(overflow).toBe(false);
    });
  }
}
