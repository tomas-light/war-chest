import i18n, { type ResourceKey } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';
import { initReactI18next } from 'react-i18next';
import {
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
} from '#/shared/config/supportedLanguages';

const DEFAULT_LANGUAGE: SupportedLanguage = 'ru';
const LANGUAGE_STORAGE_KEY = 'war-chest-language';
const TRANSLATION_MODULES = import.meta.glob<ResourceKey>(
  '/src/**/i18n/{en,ru}.json',
  { import: 'default' }
);

export async function initializeI18n(): Promise<void> {
  if (i18n.isInitialized) {
    updateDocumentLanguage(i18n.resolvedLanguage ?? DEFAULT_LANGUAGE);
    return;
  }

  i18n.on('languageChanged', updateDocumentLanguage);

  await i18n
    .use(LanguageDetector)
    .use(resourcesToBackend(loadTranslationResources))
    .use(initReactI18next)
    .init({
      defaultNS: false,
      detection: {
        caches: ['localStorage'],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        order: ['localStorage', 'navigator'],
      },
      enableSelector: false,
      fallbackLng: DEFAULT_LANGUAGE,
      interpolation: {
        escapeValue: false,
      },
      load: 'languageOnly',
      ns: [],
      returnNull: false,
      supportedLngs: SUPPORTED_LANGUAGES,
    });

  updateDocumentLanguage(i18n.resolvedLanguage ?? DEFAULT_LANGUAGE);
}

async function loadTranslationResources(
  language: string,
  namespace: string
): Promise<ResourceKey> {
  const modulePath = `/src/${namespace}/i18n/${language}.json`;
  const loadModule = TRANSLATION_MODULES[modulePath];

  if (loadModule === undefined) {
    throw new Error(`Translation module was not found: ${modulePath}.`);
  }

  return loadModule();
}

function updateDocumentLanguage(language: string): void {
  document.documentElement.lang = language;
  document.documentElement.dir = i18n.dir(language);
}
