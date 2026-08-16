# War Chest

War Chest — Yarn Workspaces-монорепозиторий браузерной игры. В репозитории
находятся React/Vite-клиент, Fastify/Socket.IO-server и общие пакеты игровой
модели, базы данных, авторизации и transport-контрактов.

Актуальная документация начинается с [docs/README.md](./docs/README.md):

- [фактическое поведение web-клиента](./docs/client/README.md);
- [фактическое поведение server](./docs/server/README.md);
- [план дальнейшей разработки](./docs/development-plan/README.md).

## Требования

- Node.js 22.22 или новее;
- Yarn 4.17.1 через сохранённый в репозитории Yarn release;
- Docker с Docker Compose для PostgreSQL и browser-тестов.

Установить зависимости:

```shell
corepack enable
yarn install --immutable
```

## Development

Сначала запустите PostgreSQL и примените миграции:

```shell
yarn db:up
yarn db:migrate
```

При необходимости добавьте тестовые данные:

```shell
yarn db:seed
```

Затем откройте два терминала из корня репозитория.

Server с watch mode:

```shell
yarn dev:server
```

Vite-клиент:

```shell
yarn dev:web
```

Приложение доступно на <http://localhost:5173>. Vite проксирует `/api/*` и
`/api/socket.io` на Fastify по адресу <http://localhost:3000>, поэтому browser
работает с одним origin. Development-панель позволяет переключить real/fake
backend и перезагружает страницу после изменения.

Локальные переопределения конфигурации помещаются в игнорируемые Git файлы:

```text
apps/server/env.local.yaml
apps/web/env.local.yaml
packages/auth/env.local.yaml
packages/database/env.local.yaml
```

Подробности находятся в [документации конфигурации](./docs/development-plan/configuration.md).

### Telegram-авторизация через ngrok

Telegram требует публичный HTTPS callback. После запуска server и Vite откройте
третий терминал и направьте ngrok на порт клиента:

```shell
yarn dev:ngrok
```

Затем открывайте приложение по выданному адресу `https://<dev-domain>`, а не
через localhost. Этот же домен нужно разрешить в локальной конфигурации Vite и
зарегистрировать в BotFather вместе с callback
`https://<dev-domain>/api/auth/telegram/callback`.

Полная настройка ngrok, BotFather и локальной auth-конфигурации описана в
[инструкции по входу через Telegram](./docs/auth/telegram-local-development.md).

## Production bundle

Собрать web-клиент в `apps/web/dist`:

```shell
yarn workspace @war-chest/web build
```

Перед сборкой проверьте `apps/web/env.yaml`, необязательный `env.local.yaml` и
build environment: web-конфигурация встраивается в JavaScript bundle.

## Preview production bundle

Vite preview проверяет уже собранный `apps/web/dist`, но не заменяет production
server. Для real API PostgreSQL и Fastify должны быть запущены отдельно:

```shell
yarn db:up
yarn workspace @war-chest/server start
```

В другом терминале:

```shell
yarn workspace @war-chest/web preview
```

Preview доступен на <http://localhost:4173> и проксирует API на порт 3000.
Dev-панель и fake backend в этом режиме отсутствуют.

## Production mode

В production Fastify раздаёт собранный SPA и API с одного origin.

1. Соберите web bundle:

   ```shell
   yarn workspace @war-chest/web build
   ```

2. В `apps/server/env.local.yaml` или environment активируйте SPA hosting:

   ```yaml
   APP_SERVE_WEB: true
   ```

3. Подготовьте базу и запустите server без watch mode:

   ```shell
   yarn db:up
   yarn db:migrate
   yarn workspace @war-chest/server start
   ```

По умолчанию приложение доступно на <http://localhost:3000>. Fastify отдаёт
assets из `apps/web/dist`, возвращает `index.html` для client deep links и
обслуживает `/api/*` и `/api/socket.io`.

Для другого домена или HTTPS дополнительно переопределите cookie и redirect URL
в конфигурации `packages/auth`. Текущий server `start` исполняет TypeScript через
`tsx`: отдельного скомпилированного server artifact пока нет, поэтому runtime
installation должна содержать workspace dev dependencies.

## Проверки

```shell
yarn types:build
yarn lint
yarn test
yarn test:components
yarn test:e2e
yarn test:e2e:real
```

Все Playwright-команды выполняются в закреплённом Docker-образе. Real E2E также
поднимает PostgreSQL.
