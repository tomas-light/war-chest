import { expect, test } from '@playwright/test';

test.use({ locale: 'ru-RU' });

test('opens and toggles the action wheel from a hand coin', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelWhitePlayer'
  );

  const coin = page.getByRole('button', { name: /Жетон .+ [1-3]/ }).last();
  await coin.click();
  await expect(page.getByRole('button', { name: 'Пас' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Манёвр' })).toBeDisabled();

  await page.getByRole('button', { name: 'Закрыть колесо действий' }).click();
  await expect(page.getByRole('button', { name: 'Пас' })).toHaveCount(0);
});

for (const variant of [
  {
    actionIds: [
      'deploy',
      'reinforce',
      'maneuver',
      'pass',
      'initiative',
      'recruit',
    ],
    coinLabel: /Жетон .+ [1-3]/,
    count: 6,
    story: 'DuelWhitePlayer',
  },
  {
    actionIds: ['initiative', 'recruit', 'pass'],
    coinLabel: /Королевский жетон 1/,
    count: 3,
    story: 'DuelRoyalWheel',
  },
  {
    actionIds: ['deploy', 'reinforce', 'pass', 'initiative'],
    coinLabel: /Жетон .+ [1-3]/,
    count: 4,
    story: 'DuelWheelFourSectors',
  },
  {
    actionIds: ['deploy', 'reinforce', 'maneuver', 'pass', 'initiative'],
    coinLabel: /Жетон .+ [1-3]/,
    count: 5,
    story: 'DuelWheelFiveSectors',
  },
] as const) {
  test(`builds ${variant.count} adjoining wheel sectors from the supplied actions`, async ({
    page,
  }) => {
    await page.goto(
      `/?story=pages/active-game/ui/ActiveGameTable/${variant.story}`
    );
    await page.getByRole('button', { name: variant.coinLabel }).last().click();

    const wheel = page.locator(`[data-count="${variant.count}"]`);
    const actions = wheel.locator('button[data-action]');

    await expect(actions).toHaveCount(variant.count);
    await expect(wheel.locator('svg line')).toHaveCount(variant.count);
    expect(
      await actions.evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute('data-action'))
      )
    ).toEqual(variant.actionIds);
    const sectorClips = await actions.evaluateAll((buttons) =>
      buttons.map((button) => getComputedStyle(button).clipPath)
    );

    expect(new Set(sectorClips).size).toBe(variant.count);
    for (const clipPath of sectorClips) {
      expect(clipPath).toMatch(/^polygon\(/);
    }
  });
}

test('sends the pass command when its sector is clicked', async ({ page }) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelWhitePlayer'
  );
  await page
    .getByRole('button', { name: /Жетон .+ [1-3]/ })
    .last()
    .click();

  const passRequest = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/pass')
  );
  await page.getByRole('button', { name: 'Пас' }).click();

  const request = await passRequest;

  expect(request.postDataJSON()).toEqual(
    expect.objectContaining({
      coinIndex: expect.any(Number),
      expectedVersion: 6,
    })
  );
});

test('highlights only the hovered or focused wheel sector', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelWhitePlayer'
  );
  await page
    .getByRole('button', { name: /Жетон .+ [1-3]/ })
    .last()
    .click();

  const pass = page.getByRole('button', { name: 'Пас' });
  const recruit = page.getByRole('button', { name: 'Нанять' });

  await page.mouse.move(0, 0);
  const restingFill = await pass.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  );

  await pass.hover();
  await expect(pass).not.toHaveCSS('background-color', restingFill);
  await expect(recruit).toHaveCSS('background-color', restingFill);
  await expect(recruit).toBeDisabled();

  await pass.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');

  await expect(pass).toBeFocused();
  await expect(pass.locator('[data-icon-first]')).toHaveCSS(
    'outline-style',
    'solid'
  );
});

test('keeps a pass error visible when the wheel opens near the viewport edge', async ({
  page,
}) => {
  await page.route('**/api/games/*/pass', async (route) => {
    await route.fulfill({ body: '{}', status: 500 });
  });
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelWhitePlayer'
  );
  await page
    .getByRole('button', { name: /Жетон .+ [1-3]/ })
    .last()
    .click();
  await page.getByRole('button', { name: 'Пас' }).click();

  await expect(page.getByRole('alert')).toBeInViewport();
});

test('keeps the five-sector wheel inside a narrow mobile viewport', async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 320 });
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelWheelFiveSectors'
  );
  await page
    .getByRole('button', { name: /Жетон .+ [1-3]/ })
    .last()
    .click();

  const wheelBounds = await page.locator('[data-count="5"]').boundingBox();

  expect(wheelBounds).not.toBeNull();
  if (wheelBounds !== null) {
    expect(wheelBounds.x).toBeGreaterThanOrEqual(0);
    expect(wheelBounds.x + wheelBounds.width).toBeLessThanOrEqual(320);
  }
});

test('virtualizes a long turn history and reaches the current cycle', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelQueueHistory'
  );

  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const list = queue.getByRole('list');

  await expect(list).toBeVisible();
  expect(await queue.getByRole('listitem').count()).toBeLessThan(20);

  await list.evaluate((element) => {
    element.scrollTop = 0;
  });

  await expect(
    queue.getByRole('button', { name: /спасовал/ }).first()
  ).toBeVisible();

  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  await expect(
    queue.getByRole('button', { name: 'Сейчас ходит Марина' })
  ).toBeVisible();
  expect(await queue.getByRole('listitem').count()).toBeLessThan(20);
});

test('scrolls the queue to the active avatar when the turn changes', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelQueueTurnAdvance'
  );

  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const list = queue.getByRole('list');

  await expect(
    queue.getByRole('button', { name: 'Сейчас ходит Марина' })
  ).toBeInViewport();

  await list.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.getByRole('button', { name: 'Передать ход' }).click();

  await expect(
    queue.getByRole('button', { name: 'Сейчас ходит Алексей' })
  ).toBeInViewport();
  expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(
    0
  );
});

test('animates the short queue when the active turn advances', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelQueueShortTurnAdvance'
  );

  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const list = queue.getByRole('list');
  const initialScrollTop = await list.evaluate((element) => element.scrollTop);

  await list.evaluate((element) => {
    element.dataset.scrollSamples = '';
    element.addEventListener('scroll', () => {
      element.dataset.scrollSamples += `${element.scrollTop},`;
    });
  });

  await page.getByRole('button', { name: 'Передать ход' }).click();

  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(initialScrollTop + 50);

  const finalScrollTop = await list.evaluate((element) => element.scrollTop);
  const scrollSamples = await list.evaluate((element) =>
    (element.dataset.scrollSamples ?? '').split(',').filter(Boolean).map(Number)
  );

  expect(
    scrollSamples.some(
      (scrollTop) =>
        scrollTop > initialScrollTop + 2 && scrollTop < finalScrollTop - 2
    )
  ).toBe(true);
  await expect(
    queue.getByRole('button', { name: 'Сейчас ходит Алексей' })
  ).toHaveCSS('transition-duration', /0\.36s/);
});

test('keeps smooth scrolling when the history query rolls over after each turn', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ height: 480, width: 320 });
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelQueueRollingHistory'
  );

  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const list = queue.getByRole('list');
  const advanceButton = page.getByRole('button', { name: 'Передать ход' });

  await list.evaluate((element) => {
    element.dataset.scrollEnds = '0';
    element.addEventListener('scrollend', () => {
      element.dataset.scrollEnds = String(
        Number(element.dataset.scrollEnds) + 1
      );
    });
  });

  await advanceButton.click();
  await expect
    .poll(() => list.evaluate((element) => Number(element.dataset.scrollEnds)))
    .toBeGreaterThan(0);

  const firstScrollEndCount = await list.evaluate((element) =>
    Number(element.dataset.scrollEnds)
  );
  const firstScrollTop = await list.evaluate((element) => element.scrollTop);

  await list.evaluate((element) => {
    element.dataset.scrollSamples = '';
    element.addEventListener('scroll', () => {
      element.dataset.scrollSamples += `${element.scrollTop},`;
    });
  });

  await advanceButton.click();
  await expect
    .poll(() => list.evaluate((element) => Number(element.dataset.scrollEnds)))
    .toBeGreaterThan(firstScrollEndCount);

  const finalScrollTop = await list.evaluate((element) => element.scrollTop);
  const scrollSamples = await list.evaluate((element) =>
    (element.dataset.scrollSamples ?? '').split(',').filter(Boolean).map(Number)
  );

  expect(finalScrollTop).toBeGreaterThan(firstScrollTop + 40);
  expect(
    scrollSamples.some(
      (scrollTop) =>
        scrollTop > firstScrollTop + 2 && scrollTop < finalScrollTop - 2
    )
  ).toBe(true);
  await expect(
    queue.getByRole('button', { name: 'Сейчас ходит Марина' }).locator('..')
  ).toHaveAttribute('aria-posinset', '5');
});

test('moves the next avatar upward before delayed history arrives', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelQueueDelayedHistory'
  );

  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const list = queue.getByRole('list');
  const upcomingAvatar = queue
    .getByRole('button', { name: 'Следующий ход: Алексей' })
    .first();
  const initialAvatarBounds = await upcomingAvatar.boundingBox();
  const initialScrollTop = await list.evaluate((element) => element.scrollTop);

  expect(initialAvatarBounds).not.toBeNull();
  if (initialAvatarBounds === null) {
    return;
  }

  await list.evaluate((element) => {
    element.dataset.positionSamples = '';
    element.addEventListener('scroll', () => {
      const currentAvatar = element.querySelector(
        '[aria-label="Сейчас ходит Алексей"]'
      );

      if (currentAvatar !== null) {
        element.dataset.positionSamples += `${currentAvatar.getBoundingClientRect().y},`;
      }
    });
  });

  await page.getByRole('button', { name: 'Передать ход' }).click();
  const currentAvatar = queue.getByRole('button', {
    name: 'Сейчас ходит Алексей',
  });

  await expect
    .poll(() => list.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(initialScrollTop + 50);
  await expect(queue.getByRole('listitem')).toHaveCount(8);
  await expect
    .poll(async () => (await currentAvatar.boundingBox())?.y ?? 0)
    .toBeLessThan(initialAvatarBounds.y - 40);

  const avatarBoundsBeforeHistory = await currentAvatar.boundingBox();
  const positionSamples = await list.evaluate((element) =>
    (element.dataset.positionSamples ?? '')
      .split(',')
      .filter(Boolean)
      .map(Number)
  );

  expect(
    positionSamples.some(
      (position) =>
        position < initialAvatarBounds.y - 2 &&
        position > (avatarBoundsBeforeHistory?.y ?? 0) + 2
    )
  ).toBe(true);

  await page.getByRole('button', { name: 'Загрузить историю' }).click();
  await expect(
    queue.getByRole('button', { name: 'Марина спасовал' }).last()
  ).toBeVisible();

  const avatarBoundsAfterHistory = await currentAvatar.boundingBox();

  expect(avatarBoundsBeforeHistory).not.toBeNull();
  expect(avatarBoundsAfterHistory).not.toBeNull();
  if (avatarBoundsBeforeHistory !== null && avatarBoundsAfterHistory !== null) {
    expect(
      Math.abs(avatarBoundsAfterHistory.y - avatarBoundsBeforeHistory.y)
    ).toBeLessThan(8);
  }
});

test('keeps the active avatar visible after a turn on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ height: 640, width: 320 });
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelQueueShortTurnAdvance'
  );

  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });

  await page.getByRole('button', { name: 'Передать ход' }).click();

  await expect(
    queue.getByRole('button', { name: 'Сейчас ходит Алексей' })
  ).toBeInViewport();
  expect(
    await queue.getByRole('list').evaluate((element) => element.scrollTop)
  ).toBeGreaterThan(0);
});

test('removes queue transitions when reduced motion is requested', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelQueueShortTurnAdvance'
  );

  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });

  await page.getByRole('button', { name: 'Передать ход' }).click();

  await expect(
    queue.getByRole('button', { name: 'Сейчас ходит Алексей' })
  ).toHaveCSS('transition-duration', '0s');
});

test('shows the next round when the current coin is the last one', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelQueueLastCoin'
  );

  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });

  await expect(queue.getByRole('listitem')).toHaveCount(5);
  await expect(
    queue.getByRole('button', { name: 'Сейчас ходит Марина' })
  ).toBeVisible();
  await expect(
    queue.getByRole('button', { name: 'Следующий ход: Алексей' })
  ).toHaveCount(3);
  await expect(
    queue.getByRole('button', { name: 'Следующий ход: Марина' })
  ).toHaveCount(1);
});

test('shows the next round after the last turn of the current round', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelQueueRoundBoundary'
  );

  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const steps = queue.getByRole('listitem');

  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0).getByRole('button')).toHaveAttribute(
    'aria-label',
    'Сейчас ходит Алексей'
  );
  await expect(steps.nth(1).getByRole('button')).toHaveAttribute(
    'aria-label',
    'Следующий ход: Марина'
  );
  await expect(steps.nth(2).getByRole('button')).toHaveAttribute(
    'aria-label',
    'Следующий ход: Алексей'
  );
});

test('keeps consecutive turns in the queue until the current player returns', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelQueueConsecutiveTurns'
  );

  const queue = page.getByRole('complementary', { name: 'Очередь ходов' });
  const steps = queue.getByRole('listitem');

  await expect(steps).toHaveCount(4);
  await expect(steps.nth(0).getByRole('button')).toHaveAttribute(
    'aria-label',
    'Сейчас ходит Марина'
  );
  await expect(steps.nth(1).getByRole('button')).toHaveAttribute(
    'aria-label',
    'Следующий ход: Алексей'
  );
  await expect(steps.nth(2).getByRole('button')).toHaveAttribute(
    'aria-label',
    'Следующий ход: Алексей'
  );
  await expect(steps.nth(3).getByRole('button')).toHaveAttribute(
    'aria-label',
    'Следующий ход: Марина'
  );
});

test('renders all duel cells and keeps the white edge at the white player', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelWhitePlayer'
  );

  await expect(page.getByRole('gridcell')).toHaveCount(37);
  await expect(
    page.locator('[role="gridcell"][data-kind="ground"]')
  ).toHaveCount(27);
  await expect(
    page.locator('[role="gridcell"][data-kind="controlPoint"]')
  ).toHaveCount(10);
  const whiteEdge = await page
    .getByRole('gridcell', { name: 'Клетка A1' })
    .boundingBox();
  const blackEdge = await page
    .getByRole('gridcell', { name: 'Клетка G7' })
    .boundingBox();

  expect(whiteEdge).not.toBeNull();
  expect(blackEdge).not.toBeNull();
  if (whiteEdge !== null && blackEdge !== null) {
    expect(whiteEdge.y).toBeGreaterThan(blackEdge.y);
  }
});

test('rotates canonical cells for the black player without changing cell ids', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelWhitePlayer'
  );

  const whiteA1 = await page
    .getByRole('gridcell', { name: 'Клетка A1' })
    .boundingBox();
  const whiteD4 = await page
    .getByRole('gridcell', { name: 'Клетка D4' })
    .boundingBox();
  const whiteG7 = await page
    .getByRole('gridcell', { name: 'Клетка G7' })
    .boundingBox();

  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelBlackPlayer'
  );

  const blackA1 = await page
    .getByRole('gridcell', { name: 'Клетка A1' })
    .boundingBox();
  const blackD4 = await page
    .getByRole('gridcell', { name: 'Клетка D4' })
    .boundingBox();
  const blackG7 = await page
    .getByRole('gridcell', { name: 'Клетка G7' })
    .boundingBox();

  expect(whiteA1).not.toBeNull();
  expect(whiteD4).not.toBeNull();
  expect(whiteG7).not.toBeNull();
  expect(blackA1).not.toBeNull();
  expect(blackD4).not.toBeNull();
  expect(blackG7).not.toBeNull();
  if (
    whiteA1 !== null &&
    whiteD4 !== null &&
    whiteG7 !== null &&
    blackA1 !== null &&
    blackD4 !== null &&
    blackG7 !== null
  ) {
    expect(blackA1.x).toBeCloseTo(whiteG7.x, 2);
    expect(blackA1.y).toBeCloseTo(whiteG7.y, 2);
    expect(blackD4.x).toBeCloseTo(whiteD4.x, 2);
    expect(blackD4.y).toBeCloseTo(whiteD4.y, 2);
    expect(blackG7.x).toBeCloseTo(whiteA1.x, 2);
    expect(blackG7.y).toBeCloseTo(whiteA1.y, 2);
    expect(blackG7.y).toBeGreaterThan(blackA1.y);
  }
});

test('renders the complete team layout and mobile teammate switches', async ({
  page,
}) => {
  await page.setViewportSize({ height: 1200, width: 390 });
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/TeamWhitePlayer'
  );

  await expect(page.getByRole('gridcell')).toHaveCount(47);
  await expect(
    page.locator('[role="gridcell"][data-kind="ground"]')
  ).toHaveCount(33);
  await expect(
    page.locator('[role="gridcell"][data-kind="controlPoint"]')
  ).toHaveCount(14);
  await expect(page.locator('[role="gridcell"][data-zone="team"]')).toHaveCount(
    8
  );
  await expect(
    page.locator('[role="gridcell"][data-kind="ground"][data-zone="team"]')
  ).toHaveCount(6);
  const switchButtons = page.getByRole('button', {
    name: 'Показать другого игрока команды',
  });

  await expect(switchButtons).toHaveCount(2);
  const switchButtonBounds = await switchButtons.first().boundingBox();
  expect(switchButtonBounds).not.toBeNull();
  if (switchButtonBounds !== null) {
    expect(switchButtonBounds.width).toBe(44);
    expect(switchButtonBounds.height).toBe(44);
  }

  await switchButtons.first().click();
  await expect(page.getByText('Дмитрий')).toBeVisible();
});

test('resets the mobile battlefield view when switching to desktop', async ({
  page,
}) => {
  await page.setViewportSize({ height: 1200, width: 390 });
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelWhitePlayer'
  );

  const canvas = page.getByRole('gridcell').first().locator('..');

  await page.getByRole('button', { name: 'Увеличить поле' }).click();
  await expect(canvas).toHaveAttribute('style', /scale\(1\.25\)/);

  await page.setViewportSize({ height: 1000, width: 1280 });

  await expect(canvas).toHaveAttribute(
    'style',
    'transform: translate(0px, 0px) scale(1);'
  );
});
