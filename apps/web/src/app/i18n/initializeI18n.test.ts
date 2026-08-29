import i18n from 'i18next';
import { afterEach, expect, test, vi } from 'vitest';
import { initializeI18n } from './initializeI18n';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('loads readable session error translations for the app router', async () => {
  const localStorage = createLanguageStorage();

  vi.stubGlobal('document', {
    documentElement: { dir: '', lang: '' },
  });
  vi.stubGlobal('navigator', {
    language: 'ru-RU',
    languages: ['ru-RU'],
  });
  vi.stubGlobal('window', { localStorage });

  await initializeI18n();
  await i18n.loadNamespaces('app/router');

  const translate = i18n.getFixedT('ru', 'app/router', 'AppRouter');

  expect(translate('sessionErrorTitle')).toBe('Нет соединения');
  expect(translate('sessionErrorDescription')).toBe(
    'Не удалось связаться с сервером и проверить сессию.'
  );
  expect(translate('retry')).toBe('Повторить');
});

function createLanguageStorage(): Storage {
  return {
    clear() {},
    getItem(key) {
      return key === 'war-chest-language' ? 'ru' : null;
    },
    key() {
      return null;
    },
    length: 1,
    removeItem() {},
    setItem() {},
  };
}
