# Разработка клиента без сервера

Клиент должен полноценно запускаться без Node.js-сервера и PostgreSQL. Такой
режим нужен для независимой работы над вёрсткой, состояниями страниц,
анимациями игровых событий и пользовательскими сценариями.

Fake-режим не меняет код страниц и features. Они обращаются к тем же контрактам,
что и при обычном запуске, а источник данных выбирается один раз на уровне
приложения.

## Переключение backend

Dev-панель монтируется в `app` выше роутера и авторизации, поэтому доступна на
любой странице, включая `/login` и страницы с ошибкой API. Она существует во
всех development-сборках и не зависит от runtime feature flags или доступности
сервера.

Панель позволяет выбрать:

- `real` — HTTP-запросы уходят на Fastify, игровые соединения — в Socket.IO;
- `fake` — запросы и игровые соединения обслуживает fake backend в браузере.

Выбор хранится через Zustand `persist` в `localStorage`:

```ts
interface DevBackendState {
  backend: "real" | "fake";
  setBackend(backend: "real" | "fake"): void;
}
```

Переключение закрывает текущее игровое соединение и сбрасывает кэш запросов.
На первом этапе после смены backend допустима полная перезагрузка вкладки: это
даёт всем providers единый источник данных и исключает смешивание real- и
fake-состояния.

При запуске app shell сначала читает сохранённый backend, а уже затем
инициализирует API и загружает application feature flags. Недоступность real API
не должна скрывать `/login` или dev-панель: пользователь видит ошибку соединения
и может переключиться в fake-режим.

Dev-панель и fake backend подключаются только при `import.meta.env.DEV`. Fake
реализация загружается через динамический `import()` после выбора режима:

```ts
if (import.meta.env.DEV && backend === "fake") {
  const { createFakeBackend } = await import("./fake/create-fake-backend");
  return createFakeBackend();
}
```

Vite статически заменяет `import.meta.env.DEV` при сборке, поэтому dev-ветка
удаляется tree shaking. В проверке production-сборки дополнительно убеждаемся,
что fake worker и `@war-chest/fake-database` не попали ни в основной bundle, ни
в отдельный chunk.

### Единый gateway

В `shared/api` находятся transport-независимые контракты и gateway:

```text
apps/web/src/shared/api/
  contracts/
    api-client.ts
    game-connection.ts
    development-api.ts
  gateway/
    backend-provider.tsx
    create-backend.ts
  real/
    real-api-client.ts
    socket-io-game-connection.ts
  fake/
    create-fake-backend.ts
    fake-backend.shared-worker.ts
```

Страницы, widgets, features и entities зависят только от контрактов. Они не
импортируют `fetch`, Socket.IO, `SharedWorker`, IndexedDB или конкретный backend.
Gateway предоставляет как обычные request/response-методы, так и единый
интерфейс игрового соединения с подпиской на события.

Fake backend реализует те же ответы, ошибки, version checks и порядок игровых
событий, что и real backend. Общий набор contract-тестов запускается против
обеих реализаций.

## Fake backend и IndexedDB

Fake backend работает в `SharedWorker`. Все вкладки одного origin подключаются к
нему через собственный `MessagePort`. Worker последовательно обрабатывает
игровые команды, держит активные соединения и рассылает fake WebSocket-события
подключённым вкладкам.

`SharedWorker` может обращаться к IndexedDB. База также привязана к origin,
поэтому вкладки с одинаковыми протоколом, host и port используют одно постоянное
хранилище. Данные переживают reload; если worker был остановлен, он
восстанавливает состояние из IndexedDB так же, как сервер восстанавливает его из
PostgreSQL.

### Пакет `packages/fake-database`

✅ Browser-only workspace-пакет реализован. Фактический API, схема и принятые
ограничения описаны в разделе [Fake database](../../fake-database/README.md).

```text
packages/fake-database/
  src/
    database.ts
    fake-database.ts
    schema.ts
    migrations.ts
    table.ts
    repositories/
    seed.ts
    reset.ts
    index.ts
  tests/
    fake-database.test.ts
    tsconfig.json
  package.json             зависимости от idb и типов database
  tsconfig.json
```

Пакет содержит схему и миграции IndexedDB, типизированный табличный слой,
репозитории, начальные fixtures и очистку fake-данных. Он не зависит от React и
не импортируется real backend. Доменные сущности переиспользуются из
`@war-chest/database` только на уровне типов.

После реализации fake backend базу должен открывать и изменять только
`SharedWorker`, чтобы команды из разных вкладок не создавали две конкурирующие
копии серверного состояния. Сам worker в пакет не входит и пока не реализован.

Для всей работы с IndexedDB используем npm-пакет `idb`. Схема, транзакции,
миграции и репозитории `packages/fake-database` работают через его promise-based
API и типизированные database schemas; прямую работу с `IDBRequest` по проекту
не распространяем.

Fake-схема повторяет логические сущности, нужные контракту клиента: пользователей
и сессии, игры и участников, обработанные команды, события и fake runtime
feature flags. Физическую PostgreSQL-схему она не копирует один в один. Из
индексов добавлен только уникальный `[gameId, sequence]` для истории событий;
малые коллекции фильтруются в памяти.

### Два пользователя

Для локальной игры двумя пользователями открываем две вкладки или два окна
одного браузерного профиля по одному origin. Они подключаются к одному
`SharedWorker` и видят одну IndexedDB.

Выбранный backend хранится в общем `localStorage`, но fake-пользователь относится
к конкретной вкладке и хранится в `sessionStorage`. Worker связывает identity с
её `MessagePort`, поэтому две вкладки могут одновременно иметь разные fake
сессии и играть друг с другом.

### Fake-авторизация

В fake-режиме экран `/login` сохраняет три привычных способа входа, но не
обращается к внешним OAuth-провайдерам:

- кнопка Google входит в предопределённый fake Google-аккаунт;
- кнопка Telegram входит в предопределённый fake Telegram-аккаунт;
- кнопка Yandex входит в предопределённый fake Yandex-аккаунт.

Каждый provider всегда соответствует своему отдельному аккаунту из seed
`packages/fake-database`. Повторный вход через ту же кнопку находит того же
пользователя. После reset базы seed создаёт эти аккаунты заново с теми же
стабильными идентификаторами.

Кнопка вызывает общий контракт авторизации с именем provider. Real-адаптер
запускает обычный Google, Telegram или Yandex flow, а fake-адаптер отправляет
provider в `SharedWorker`. Worker находит соответствующую fake identity, создаёт
сессию для `MessagePort` текущей вкладки и возвращает тот же профиль сессии, что
ожидает остальной клиент.

Fake-вход не открывает popup, не выполняет redirect и не загружает SDK
провайдера. Выбранная fake-сессия переживает reload текущей вкладки через
`sessionStorage`, а logout очищает только эту вкладку.

Для игры двумя пользователями в первой вкладке выбираем, например, Google, а во
второй — Telegram. Если обе вкладки нажали одну provider-кнопку, они ожидаемо
войдут в один и тот же fake-аккаунт. Такие вкладки представляют одного
пользователя и не могут занять два места в одной игре. Повторное присоединение
возвращает уже существующее участие этого пользователя, а не создаёт второго
игрока. Для совместной партии нужно войти через две разные provider-кнопки.

Разные браузеры, разные профили браузера и разные origin не разделяют
`SharedWorker` или IndexedDB. Для сквозного теста между такими клиентами
используем real server. Отдельный локальный fake server не разрабатываем.

Multi-user fake mode поддерживаем только в development-браузерах с
`SharedWorker`. Если API недоступен, dev-панель явно сообщает об ограничении;
скрытый fallback с другим поведением не используем.

### Управление feature flags

Локальные overrides игровых feature flags в Zustand больше не используем. В
fake-режиме dev-панель изменяет данные самой fake-игры через отдельный
`DevelopmentApi`:

```ts
interface DevelopmentApi {
  updateGameFeatureFlags(
    gameId: string,
    featureFlags: FeatureFlags,
  ): Promise<{ applied: boolean; reason?: "fake-mode-only" }>;
}
```

Fake-реализация в одной транзакции IndexedDB обновляет snapshot feature flags в
сохранённом `GameCreated`, заново применяет цепочку событий и рассылает
подключённым вкладкам fake-only сигнал сброса. Адаптеры очищают локальную историю,
заново загружают изменённый `GameCreated` и отдают приложению новый
`game:snapshot`. Это dev-операция редактирования fixture, а не новое игровое
событие.

В real-режиме метод возвращает `{ applied: false, reason: "fake-mode-only" }` и
не отправляет HTTP-запрос. Отдельный no-op endpoint на production-сервере не
создаём. Панель показывает игровые флаги read-only, когда выбран `real`.

Редактирование fixture — осознанное исключение только для fake-разработки. Оно
не меняет production-правило: в real backend feature flags после `GameCreated`
неизменяемы.

Fake-реализация `GET /config/feature-flags.json` читает application flags из
IndexedDB. Seed и reset позволяют подготовить начальный набор без работающего
сервера.

## Порядок реализации и проверка

1. Вынести HTTP и Socket.IO за общие контракты `shared/api`.
2. Добавить backend gateway и real-адаптеры.
3. Смонтировать dev-панель над роутером и добавить persisted-переключатель.
4. ✅ Создан `packages/fake-database` на базе npm-пакета `idb`: добавлены схема
   IndexedDB, миграция, таблицы, репозитории, транзакции, seed и reset.
5. Реализовать fake backend в `SharedWorker` и RPC через `MessagePort`.
6. Добавить три seeded fake-аккаунта и provider-specific авторизацию через
   кнопки Google, Telegram и Yandex.
7. Реализовать fake HTTP-контракт и fake игровое соединение.
8. Добавить fake-only управление feature flags через `DevelopmentApi`.
9. Запустить общий набор contract-тестов против real и fake реализаций.
10. Проверить состав production bundle.

Критерии готовности:

- dev-панель открывается на любой странице, даже если real API недоступен;
- выбранный backend переживает reload;
- страницы и features не знают, какой backend выбран;
- переключение backend не смешивает кэши и игровые соединения;
- fake-модуль загружается только после выбора `fake`;
- production bundle не содержит fake backend и `@war-chest/fake-database`;
- `packages/fake-database` обращается к IndexedDB через `idb`;
- fake-данные переживают reload и восстановление SharedWorker;
- две вкладки одного origin играют разными fake-пользователями;
- каждая provider-кнопка входит в свой стабильный fake-аккаунт;
- fake-вход не обращается к OAuth-провайдерам;
- fake-сессия и logout изолированы в пределах вкладки;
- две вкладки одного fake-аккаунта не могут играть друг против друга;
- команды из вкладок обрабатываются последовательно и рассылаются обеим;
- fake feature flags хранятся в IndexedDB, а не в Zustand overrides;
- изменение fake-флагов пересобирает игру и синхронизирует вкладки;
- real-режим не изменяет игровые feature flags через dev-панель;
- contract-тесты подтверждают одинаковую форму ответов и ошибок.

## Полезные ссылки

- [MDN: SharedWorker](https://developer.mozilla.org/en-US/docs/Web/API/SharedWorker)
- [MDN: IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [MDN: IndexedDB в WorkerGlobalScope](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/indexedDB)
- [npm: idb](https://www.npmjs.com/package/idb)
- [Vite: env variables и production tree shaking](https://vite.dev/guide/env-and-mode)
