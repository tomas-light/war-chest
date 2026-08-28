# Runtime и выбор языка

`initializeI18n()` вызывается до первого React render. Он подключает:

- `i18next-browser-languagedetector` для сохранённого выбора и языка браузера;
- `i18next-resources-to-backend` вместе с `import.meta.glob` для загрузки
  JSON-ресурса только тогда, когда компонент запрашивает namespace;
- `initReactI18next` для `useTranslation` и React Suspense.

Поддерживаемые языки перечислены в `shared/config/supportedLanguages.ts`.
Русский используется как fallback. При смене языка i18next загружает нужные
namespace, обновляет компоненты и записывает выбор в `localStorage`.

`LanguageSelector` находится в `features/change-language`. Он показан на
странице входа, в навигации авторизованного пользователя и на экране ошибки
проверки сессии. Названия языков выводятся на самих языках: `Русский` и
`English`.

Component gallery и основная точка входа используют одну и ту же инициализацию,
поэтому stories проверяют реальные ресурсы и поведение detector.
