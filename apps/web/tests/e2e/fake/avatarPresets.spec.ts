import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const SPRITE_URL_PATTERN = /\/avatarPresets[^/]*\.png(?:\?|$)/;

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]) {
  test.describe(`avatar presets at ${viewport.width}px`, () => {
    test.use({
      viewport,
      deviceScaleFactor: 2,
    });

    test('loads the whole catalog once and keeps the selected avatar after reload', async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({
        reducedMotion: viewport.width === 320 ? 'reduce' : 'no-preference',
      });
      const spriteRequests: string[] = [];
      const avatarRequests: string[] = [];
      page.on('request', (request) => {
        if (
          request.resourceType() === 'image' &&
          SPRITE_URL_PATTERN.test(request.url())
        ) {
          spriteRequests.push(request.url());
        }
        if (/\/api\/users\/[^/]+\/avatar(?:\?|$)/.test(request.url())) {
          avatarRequests.push(request.url());
        }
      });
      await page.addInitScript(() => {
        localStorage.setItem(
          'war-chest-dev-backend',
          JSON.stringify({ state: { backend: 'fake' }, version: 0 })
        );
      });
      await page.goto('/login');
      await page
        .getByLabel('Email', { exact: true })
        .fill('archer@example.com');
      await page.getByRole('button', { name: 'Получить код' }).click();
      await page.getByLabel('Код из письма').fill('123456');
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await expect(page).toHaveURL(/\/lobby$/);
      await page.getByRole('link', { name: 'Профиль', exact: true }).click();

      const presetButtons = page.locator('button[aria-pressed]');
      await expect(presetButtons).toHaveCount(16);
      await expect
        .poll(async () =>
          page
            .locator('img')
            .evaluateAll((images) =>
              images.every(
                (image) =>
                  image instanceof HTMLImageElement &&
                  image.complete &&
                  image.naturalWidth > 0
              )
            )
        )
        .toBe(true);
      expect(new Set(spriteRequests).size).toBe(1);
      expect(spriteRequests).toHaveLength(1);
      expect(avatarRequests).toHaveLength(0);

      const clown = page.getByRole('button', { name: 'Клоун', exact: true });
      await clown.focus();
      await expect(clown).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(clown).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('status')).toContainText('Аватар обновлён.');
      await expect(
        page
          .getByRole('img', { name: 'Аватар пользователя Archer' })
          .first()
          .locator('img')
      ).toHaveCSS('left', '-90px');
      await page.reload();
      await expect(clown).toHaveAttribute('aria-pressed', 'true');
      await expect(
        page.getByRole('heading', { name: 'Загрузка', exact: true })
      ).toHaveCount(0);
      await page.screenshot({
        path: testInfo.outputPath('profile.png'),
        fullPage: true,
        animations: 'disabled',
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true);
      await page.getByRole('button', { name: 'Удалить аватар' }).click();
      await expect(page.locator('button[aria-pressed="true"]')).toHaveCount(0);
      await expect(
        page.getByRole('img', { name: 'Аватар пользователя Archer' }).first()
      ).toHaveText('A');

      await page
        .locator('input[type="file"]')
        .setInputFiles(
          fileURLToPath(
            new URL(
              '../../../public/brand/war-chest-logo-512.png',
              import.meta.url
            )
          )
        );
      await expect(
        page
          .getByRole('img', { name: 'Аватар пользователя Archer' })
          .first()
          .locator('img')
      ).toHaveAttribute('src', /^data:image\/png;base64,/);
      await page.locator('input[type="file"]').setInputFiles({
        name: 'invalid.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('invalid avatar'),
      });
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(
        page
          .getByRole('img', { name: 'Аватар пользователя Archer' })
          .first()
          .locator('img')
      ).toHaveAttribute('src', /^data:image\/png;base64,/);
      await clown.click();
      await expect(clown).toHaveAttribute('aria-pressed', 'true');
    });
  });
}

test('keeps initials and the avatar size when the sprite cannot load', async ({
  page,
}) => {
  await page.route(SPRITE_URL_PATTERN, (route) =>
    route.request().resourceType() === 'image'
      ? route.abort()
      : route.continue()
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      'war-chest-dev-backend',
      JSON.stringify({ state: { backend: 'fake' }, version: 0 })
    );
  });
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('archer@example.com');
  await page.getByRole('button', { name: 'Получить код' }).click();
  await page.getByLabel('Код из письма').fill('123456');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/lobby$/);
  const avatar = page
    .getByRole('img', { name: 'Аватар пользователя Archer' })
    .first();
  await expect(avatar).toHaveText('A');
  await expect(avatar).toHaveCSS('width', '32px');
  await expect(avatar).toHaveCSS('height', '32px');
});
