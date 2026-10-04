import { expect, test } from '@playwright/test';

test.use({ locale: 'ru-RU' });

for (const scenario of [
  {
    actions: ['move', 'capture', 'reinforce', 'attack', 'tactic'],
    story: 'DuelCavalryManeuvers',
  },
  {
    actions: ['move', 'capture', 'reinforce', 'attack'],
    story: 'DuelSwordsmanManeuvers',
  },
  {
    actions: ['move', 'capture', 'reinforce', 'tactic'],
    story: 'DuelArcherManeuvers',
  },
]) {
  test(`replaces coin actions with the unit's maneuvers: ${scenario.story}`, async ({
    page,
  }) => {
    await page.goto(
      `/?story=pages/active-game/ui/ActiveGameTable/${scenario.story}`
    );
    await page
      .getByRole('button', { name: /^Жетон / })
      .first()
      .click();
    await page.getByRole('button', { name: 'Манёвр' }).click();

    const wheel = page.locator('[data-wheel="maneuver"]');

    await expect(wheel).toHaveAttribute(
      'data-count',
      String(scenario.actions.length)
    );
    await expect(wheel.locator('[data-action]')).toHaveCount(
      scenario.actions.length
    );
    expect(
      await wheel
        .locator('[data-action]')
        .evaluateAll((buttons) =>
          buttons.map((button) => button.getAttribute('data-action'))
        )
    ).toEqual(scenario.actions);
    await expect(
      page.getByRole('button', { name: 'Пас', exact: true })
    ).toHaveCount(0);
  });
}

test('keeps unsupported maneuvers disabled when there are no attack targets', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelCavalryManeuvers'
  );
  await page
    .getByRole('button', { name: /^Жетон / })
    .first()
    .click();
  await page.getByRole('button', { name: 'Манёвр' }).click();

  const wheel = page.locator('[data-wheel="maneuver"]');

  await expect(
    wheel.getByRole('button', { name: 'Движение', exact: true })
  ).toBeEnabled();
  for (const name of ['Захват', 'Усилить', 'Атака', 'Тактика']) {
    await expect(
      wheel.getByRole('button', { name, exact: true })
    ).toBeDisabled();
  }
});

test('opens maneuvers with movement disabled when the deployed unit is surrounded', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelBlockedMovement'
  );
  await page
    .getByRole('button', { name: /^Жетон / })
    .first()
    .click();
  await page.getByRole('button', { name: 'Манёвр' }).click();
  await expect(
    page.getByRole('button', { name: 'Движение', exact: true })
  ).toBeDisabled();
});

test('returns to coin actions with Escape and restores keyboard focus', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelCavalryManeuvers'
  );
  await page
    .getByRole('button', { name: /^Жетон / })
    .first()
    .click();
  await page.getByRole('button', { name: 'Манёвр' }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Движение', exact: true })
  ).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Манёвр' })).toBeFocused();
  await expect(page.locator('[data-wheel="maneuver"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-wheel]')).toHaveCount(0);
});

test('opens coin actions when another hand coin is selected', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelCavalryManeuvers'
  );
  const coins = page.getByRole('button', { name: /^Жетон / });

  await coins.first().click();
  await page.getByRole('button', { name: 'Манёвр' }).click();
  await coins.nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-wheel="coin"]')).toBeVisible();
  await expect(page.locator('[data-wheel="maneuver"]')).toHaveCount(0);
});

for (const width of [1440, 390, 320]) {
  test(`keeps maneuver actions visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ height: 900, width });
    await page.goto(
      '/?story=pages/active-game/ui/ActiveGameTable/DuelCavalryManeuvers'
    );
    await page
      .getByRole('button', { name: /^Жетон / })
      .first()
      .click();
    await page.getByRole('button', { name: 'Манёвр' }).click();
    const wheel = page.locator('[data-wheel="maneuver"]');

    await expect(wheel).toBeInViewport({ ratio: 1 });
    await page.screenshot({
      path: `test-results/maneuver-wheel-${width}.png`,
      fullPage: true,
    });
    await wheel
      .getByRole('button', { name: 'Назад к действиям жетона' })
      .click();
    await expect(page.getByRole('button', { name: 'Манёвр' })).toBeVisible();
  });
}
