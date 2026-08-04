# Сборка и запуск клиента

У клиента есть три разных режима. Development нужен для работы с исходниками и
dev-панелью, preview проверяет готовый Vite bundle, production отдаёт этот же
bundle через Fastify с одного origin.

## Development

Команда из корня репозитория:

```shell
yarn dev:web
```

Vite слушает `0.0.0.0:5173`, требует свободный порт и проксирует `/api` и
`/api/socket.io` на `http://localhost:3000`. Изменения исходников обновляются
через Vite HMR. Только в этом режиме доступны dev-панель и fake connection.

## Production bundle

```shell
yarn workspace @war-chest/web build
```

Vite записывает результат в `apps/web/dist`. Конфигурация из `env.yaml`,
`env.local.yaml` и окружения фиксируется во время сборки. После изменения
build-time конфигурации bundle нужно собрать заново.

## Vite preview

```shell
yarn workspace @war-chest/web preview
```

Preview слушает `0.0.0.0:4173`, требует уже собранный `dist` и проксирует API на
Fastify по порту 3000. Это проверка production bundle, а не production-сервер.
`import.meta.env.DEV` в этом режиме равен `false`, поэтому fake backend и
dev-панель недоступны.

## Production через Fastify

Если `APP_SERVE_WEB: true`, server раздаёт файлы из `WEB_ASSETS_ROOT`. Значение
по умолчанию `../web/dist` разрешается относительно `apps/server` и указывает на
результат Vite-сборки.

В этом режиме SPA и API находятся на одном origin Fastify, по умолчанию
`http://localhost:3000`. Подробности cache headers и fallback описаны в
[server hosting](../server/hosting.md).
