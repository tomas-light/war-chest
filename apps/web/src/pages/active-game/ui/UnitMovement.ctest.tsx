import { expect, test } from '@playwright/test';

test.use({ locale: 'ru-RU' });

for (const story of [
  'DuelUnitMovement',
  'DuelBlackUnitMovement',
  'TeamUnitMovement',
]) {
  for (const width of [1440, 390, 320]) {
    test(`animates B1 to C2 in 200ms in ${story} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: 900, width });
      await page.goto(`/?story=pages/active-game/ui/ActiveGameTable/${story}`);
      const unit = page.locator('[data-unit-id="moving-unit"]');

      await expect(unit).toBeVisible();

      const animation = await page.evaluate(async () => {
        const unit = document.querySelector('[data-unit-id="moving-unit"]');
        const destination = document.querySelector(
          '[role="gridcell"][aria-label="Клетка C2"]'
        );
        const button = Array.from(document.querySelectorAll('button')).find(
          (button) => button.textContent === 'B1 ↔ C2'
        );

        if (unit === null || destination === null || button === undefined) {
          throw new Error(
            'The movement story must render the unit and target.'
          );
        }

        const source = unit.getBoundingClientRect();
        const target = destination.getBoundingClientRect();
        button.click();

        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve())
        );
        const animations = unit.getAnimations();
        await Promise.all(animations.map((animation) => animation.ready));

        // Inspect the real transition at its midpoint without depending on CI frame scheduling.
        for (const animation of animations) {
          animation.pause();
          animation.currentTime = 100;
        }

        const intermediate = unit.getBoundingClientRect();

        for (const animation of animations) {
          animation.play();
        }

        await Promise.all(animations.map((animation) => animation.finished));
        const final = unit.getBoundingClientRect();

        return {
          durations: animations.map(
            (animation) => animation.effect?.getTiming().duration
          ),
          finalY: final.y + final.height / 2,
          intermediateY: intermediate.y + intermediate.height / 2,
          sameElement:
            unit === document.querySelector('[data-unit-id="moving-unit"]'),
          sourceY: source.y + source.height / 2,
          targetY: target.y + target.height / 2,
        };
      });

      expect(animation.durations).toContain(200);
      expect(animation.sameElement).toBe(true);
      expect(animation.intermediateY).toBeGreaterThan(
        Math.min(animation.sourceY, animation.targetY)
      );
      expect(animation.intermediateY).toBeLessThan(
        Math.max(animation.sourceY, animation.targetY)
      );
      expect(Math.abs(animation.finalY - animation.targetY)).toBeLessThan(1);
      await expect(unit).toHaveAttribute('data-cell-id', 'C2');

      if (story === 'DuelUnitMovement' && width !== 320) {
        await page.screenshot({
          path: `test-results/unit-movement-${width}.png`,
          fullPage: true,
        });
      }
    });
  }
}

for (const story of ['DuelUnitMovement', 'TeamUnitMovement']) {
  for (const width of [1440, 390]) {
    test(`highlights ore destinations with the Figma contour in ${story} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ height: 900, width });
      await page.goto(`/?story=pages/active-game/ui/ActiveGameTable/${story}`);
      await page.getByRole('button', { name: 'B1 ↔ C2' }).click();
      await expect(
        page.getByRole('button', {
          name: 'Переместить на клетку B1',
          exact: true,
        })
      ).toBeVisible();
      const cell = page.getByRole('gridcell', {
        name: 'Клетка B1',
        exact: true,
      });
      const contour = cell.locator(':scope > span > img');

      await expect(contour).toBeVisible();
      await expect(contour).toHaveCSS('pointer-events', 'none');
      const cellBounds = await cell.boundingBox();
      const contourBounds = await contour.boundingBox();

      if (cellBounds === null || contourBounds === null) {
        throw new Error(
          'The ore destination and its movement contour must be visible.'
        );
      }

      const expectedWidthRatio =
        story === 'TeamUnitMovement' ? 95.5403 / 112 : 116.887 / 140;

      expect(contourBounds.width / cellBounds.width).toBeCloseTo(
        expectedWidthRatio,
        3
      );
      await page
        .locator('[data-unit-id="moving-unit"]')
        .evaluate(async (element) => {
          await Promise.all(
            element.getAnimations().map((animation) => animation.finished)
          );
        });
      await page.screenshot({
        path: `test-results/ore-movement-${story}-${width}.png`,
        fullPage: true,
      });
    });
  }
}

test('returns a moved unit to B1 with the same 200ms transition', async ({
  page,
}) => {
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelUnitMovement'
  );
  const unit = page.locator('[data-unit-id="moving-unit"]');
  await page.getByRole('button', { name: 'B1 ↔ C2' }).click();
  await unit.evaluate(async (element) => {
    await Promise.all(
      element.getAnimations().map((animation) => animation.finished)
    );
  });
  await page.getByRole('button', { name: 'B1 ↔ C2' }).click();

  const durations = await unit.evaluate((element) =>
    element
      .getAnimations()
      .map((animation) => animation.effect?.getTiming().duration)
  );

  expect(durations).toContain(200);
  await expect(unit).toHaveAttribute('data-cell-id', 'B1');
});

test('moves immediately when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(
    '/?story=pages/active-game/ui/ActiveGameTable/DuelUnitMovement'
  );
  const unit = page.locator('[data-unit-id="moving-unit"]');
  await expect(unit).toBeVisible();
  await expect(unit).toHaveCSS('transition-duration', '0s');

  await page.getByRole('button', { name: 'B1 ↔ C2' }).click();
  await expect(unit).toHaveAttribute('data-cell-id', 'C2');
  expect(await unit.evaluate((element) => element.getAnimations().length)).toBe(
    0
  );
});
