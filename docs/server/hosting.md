# Запуск server и SPA hosting

Server останавливает запуск до открытия порта, если конфигурация невалидна или
PostgreSQL недоступен. Это не позволяет процессу выглядеть готовым, пока его
обязательная database dependency не работает.

## Конфигурация приложения

`apps/server/env.yaml` содержит безопасные значения по умолчанию:

```yaml
APP_HOST: '0.0.0.0'
APP_PORT: 3000
APP_SERVE_WEB: false
DISCONNECTED_PLAYER_TIMEOUT_MINUTES: 15
EMPTY_WAITING_GAME_TIMEOUT_MINUTES: 10
FEATURE_FLAGS_RUNTIME_FILE: '../../packages/feature-flags/feature-flags.json'
WEB_ASSETS_ROOT: '../web/dist'
```

Значения дополняются необязательным `apps/server/env.local.yaml`, затем явными
переменными окружения. `WEB_ASSETS_ROOT` и путь feature flags разрешаются в
абсолютные пути относительно `apps/server`.

`DISCONNECTED_PLAYER_TIMEOUT_MINUTES` задаёт срок возвращения активного игрока.
`EMPTY_WAITING_GAME_TIMEOUT_MINUTES` задаёт срок жизни `waiting`-игры без
участников; после него весь игровой aggregate удаляется из PostgreSQL.
`FEATURE_FLAGS_RUNTIME_FILE` читается при создании новой игры; exact duplicate
ранее выполненного `CreateGame` возвращается без повторного чтения файла.
Файл хранится в Git как типизированный контракт и безопасные локальные значения.
Deployment подменяет в нём только boolean-значения нужного окружения, сохраняя
полный набор ключей.

Database и auth читают собственные конфигурации из `packages/database` и
`packages/auth`; server не дублирует их ключи.

## Startup lifecycle

`yarn dev:server` запускает `tsx watch`, а
`yarn workspace @war-chest/server start` — `tsx` без watch.

Во время старта server:

1. загружает server config;
2. создаёт database connection;
3. создаёт auth service;
4. собирает Fastify и Socket.IO;
5. проверяет PostgreSQL;
6. восстанавливает незавершённые игры и их deadline timers из PostgreSQL;
7. начинает слушать `APP_HOST:APP_PORT`.

Будущий reconnect deadline планируется на оставшееся время. Уже истёкший
deadline ставится в последовательную очередь игры немедленно. Строка игры
блокируется перед сохранением system events, поэтому конкурирующие workers не
создают повторное поражение.

Временная ошибка сохранения deadline-результата запускает exponential backoff
с задержками от 1 секунды до 60 секунд. Каждая попытка повторно проверяет
актуальность deadline. При закрытии service timers очищаются, а новые retries
не планируются.

При ошибке созданные ресурсы закрываются. При штатном `app.close()` Fastify
сначала закрывает Socket.IO в `preClose`, дожидается начатых игровых операций,
а затем закрывает game service и database connection в `onClose`.

Отдельного скомпилированного server artifact сейчас нет: script `start`
исполняет TypeScript через `tsx`, поэтому production installation должна
содержать эту dependency.

## Раздача production SPA

При `APP_SERVE_WEB: true` подключается `@fastify/static` с каталогом
`WEB_ASSETS_ROOT`.

- статические assets получают immutable caching до 30 дней;
- `index.html` отдаётся с `Cache-Control: no-cache`;
- неизвестный `GET`/`HEAD` с `Accept: text/html` получает `index.html`, поэтому
  reload на `/games/:gameId` и других client routes работает;
- неизвестный `/api` или запрос без HTML navigation semantics получает JSON
  `404 not_found`.

В production browser использует origin Fastify и относительные `/api/*` и
`/api/socket.io`; CORS для отдельного web-origin не настраивается.

## Vite development и preview

Когда web запускается отдельно, Vite слушает 5173 в development или 4173 в
preview и проксирует `/api` на Fastify 3000. Для этого server оставляют с
`APP_SERVE_WEB: false`.
