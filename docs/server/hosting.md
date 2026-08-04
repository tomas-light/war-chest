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
FEATURE_FLAGS_RUNTIME_FILE: '../../runtime/feature-flags/feature-flags.localhost.json'
WEB_ASSETS_ROOT: '../web/dist'
```

Значения дополняются необязательным `apps/server/env.local.yaml`, затем явными
переменными окружения. `WEB_ASSETS_ROOT` и путь feature flags разрешаются в
абсолютные пути относительно `apps/server`.

`DISCONNECTED_PLAYER_TIMEOUT_MINUTES` и `FEATURE_FLAGS_RUNTIME_FILE` уже
валидируются, но ещё не используются runtime game service.

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
6. начинает слушать `APP_HOST:APP_PORT`.

При ошибке созданные ресурсы закрываются. При штатном `app.close()` закрываются
Socket.IO и database connection.

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
