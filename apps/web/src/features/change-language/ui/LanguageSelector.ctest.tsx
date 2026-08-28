import { expect, test } from '@playwright/test';

const STORY_URL =
  '/?story=features/change-language/ui/LanguageSelector/Default';

test('changes the interface language', async ({ page }) => {
  await page.goto(STORY_URL);

  const languageSelector = page.getByRole('combobox');

  await languageSelector.selectOption('ru');
  await expect(
    page.getByRole('combobox', { name: 'Язык интерфейса' })
  ).toHaveValue('ru');

  await languageSelector.selectOption('en');
  await expect(
    page.getByRole('combobox', { name: 'Interface language' })
  ).toHaveValue('en');
});

test('restores the selected language after reload', async ({ page }) => {
  await page.goto(STORY_URL);
  await page.getByRole('combobox').selectOption('en');

  await page.reload();

  await expect(
    page.getByRole('combobox', { name: 'Interface language' })
  ).toHaveValue('en');
});
