# Конфигурация и feature flags

Конфигурация приложений и feature flags решают разные задачи. Конфигурация
описывает адреса сервисов, таймауты и параметры авторизации. Значения feature
flags можно менять при deployment без пересборки приложения, а их набор является
типизированным контрактом исходного кода.

Мы не смешиваем эти механизмы: числовой таймаут не становится флагом, а секрет авторизации не попадает в JSON, который можно отдать браузеру.

## Конфигурационные границы

У каждого приложения и инфраструктурного пакета есть собственные файлы.
Конфигурация находится рядом с кодом, который её использует, поэтому границу
можно переносить и настраивать как единое целое:

```text
apps/server/
  env.yaml
  env.local.yaml

apps/web/
  env.yaml
  env.local.yaml

packages/database/
  env.yaml
  env.local.yaml

packages/auth/
  env.yaml
  env.local.yaml
```

`env.yaml` содержит структуру конфигурации и безопасные значения по умолчанию. Он хранится в Git.

`env.local.yaml` необязателен, переопределяет отдельные значения из основного файла и не попадает в Git. В нём находятся адреса, секреты и настройки конкретного разработчика.

Загрузчик не определяет окружение и не содержит отдельных условий для `localhost`, `dev` или `production`. На стендах `env.local.yaml` просто отсутствует: файл игнорируется Git и не включается в артефакты сборки или Helm chart.

Приоритет:

```text
env.yaml
  < env.local.yaml, если файл существует
  < явно переданные переменные процесса сборки или запуска
```

Явные переменные имеют наивысший приоритет. Для клиента это переменные процесса `build`, для сервера — процесса `start`. Серверные секреты передаются при запуске, а не встраиваются в собранный JavaScript.

Конфигурация плоская. Каждый файл содержит только пары `KEY: value`, где значением может быть строка, число или boolean. Вложенные объекты и массивы не используются.

Ключи записываются в `UPPER_SNAKE_CASE` и напрямую соответствуют одноимённым переменным процесса. Каждый следующий источник просто заменяет значение совпавшего ключа.

Загрузчик должен:

- искать файлы относительно корня конкретного приложения или инфраструктурного пакета;
- читать `env.local.yaml`, если файл существует;
- корректно работать без него;
- работать только с плоскими ключами;
- переопределять значения простым присваиванием по ключу;
- последними применять явно переданные переменные;
- проверять итоговую конфигурацию по типизированной схеме;
- завершать запуск или сборку при неизвестных ключах и неверных типах;
- отдавать остальному коду только проверенную плоскую конфигурацию.

Общая техническая часть серверного загрузчика находится в
`packages/config`. Она читает и объединяет YAML-файлы, применяет только
перечисленные потребителем переменные процесса и единообразно оформляет ошибки
Zod-валидации. Сами ключи, схемы и переданные в загрузчик функции парсинга
остаются в `packages/database` и `packages/auth`, поэтому общий код не становится
владельцем конфигурации этих пакетов.

### Сервер

Пример структуры:

```yaml
APP_HOST: '0.0.0.0'
APP_PORT: 3000
APP_SERVE_WEB: false
WEB_ASSETS_ROOT: '../web/dist'
DISCONNECTED_PLAYER_TIMEOUT_MINUTES: 15
FEATURE_FLAGS_RUNTIME_FILE: '../../packages/feature-flags/feature-flags.json'
```

Сервер читает YAML во время запуска. Настройки OAuth-провайдеров и сессии
принадлежат `packages/auth` и здесь не дублируются.

`DISCONNECTED_PLAYER_TIMEOUT_MINUTES` задаёт, сколько минут незавершённая партия ждёт отключившегося игрока. Таймер начинается, когда у игрока не остаётся ни одного активного соединения. После истечения времени игроку засчитывается поражение.

### База данных

Пример `packages/database/env.yaml`:

```yaml
DATABASE_URL: 'postgres://war_chest:war_chest@localhost:5432/war_chest'
DATABASE_POOL_SIZE: 10
DATABASE_SSL: false
```

Пакет базы загружает эти файлы при создании подключения, запуске миграций,
наполнении тестовыми данными и запуске Drizzle Studio. Для него действует тот
же приоритет простого переопределения ключей:

```text
packages/database/env.yaml
  < packages/database/env.local.yaml, если файл существует
  < явно переданные переменные процесса
```

`env.yaml` хранит безопасную локальную конфигурацию и добавляется в Git.
`env.local.yaml` позволяет разработчику заменить отдельные значения, не меняя
общий файл, и игнорируется Git. На стендах локальный файл просто не
подкладывается, а нужные значения передаются процессу явно.

Сервер не дублирует `DATABASE_URL` в `apps/server/env.yaml`: при создании клиента
он вызывает публичный API `@war-chest/database`, а пакет читает конфигурацию
своей границы.

### Авторизация

Пример `packages/auth/env.yaml`:

```yaml
AUTH_SESSION_COOKIE_NAME: 'war_chest_session'
AUTH_SESSION_TTL_MINUTES: 43200
AUTH_OAUTH_STATE_TTL_MINUTES: 10
AUTH_COOKIE_SECURE: false
AUTH_COOKIE_SAME_SITE: 'lax'
AUTH_SUCCESS_REDIRECT_URL: 'http://localhost:5173'
AUTH_AVATAR_MAX_SOURCE_BYTES: 1048576
AUTH_AVATAR_FETCH_TIMEOUT_MS: 5000
AUTH_AVATAR_SIZE_PX: 256
GOOGLE_CLIENT_ID: ''
TELEGRAM_CLIENT_ID: ''
TELEGRAM_CLIENT_SECRET: ''
TELEGRAM_AUTHORIZATION_ENDPOINT: 'https://oauth.telegram.org/auth'
TELEGRAM_TOKEN_ENDPOINT: 'https://oauth.telegram.org/token'
TELEGRAM_ISSUER: 'https://oauth.telegram.org'
TELEGRAM_JWKS_ENDPOINT: 'https://oauth.telegram.org/.well-known/jwks.json'
TELEGRAM_REDIRECT_URI: 'http://localhost:5173/api/auth/telegram/callback'
YANDEX_CLIENT_ID: ''
YANDEX_CLIENT_SECRET: ''
YANDEX_AUTHORIZATION_ENDPOINT: 'https://oauth.yandex.ru/authorize'
YANDEX_TOKEN_ENDPOINT: 'https://oauth.yandex.ru/token'
YANDEX_PROFILE_ENDPOINT: 'https://login.yandex.ru/info'
YANDEX_REDIRECT_URI: 'http://localhost:5173/api/auth/yandex/callback'
```

Пакет авторизации загружает эту конфигурацию для интеграций с провайдерами и
управления собственной сессией War Chest. Приоритет тот же:

```text
packages/auth/env.yaml
  < packages/auth/env.local.yaml, если файл существует
  < явно переданные переменные процесса
```

Основной файл хранит пустые секреты и безопасные настройки localhost. Реальные
локальные credentials находятся в `env.local.yaml`; на стендах их передают
процессу явно. `apps/server/env.yaml` не дублирует эти ключи.

Google client ID — единственное значение провайдера, которое также присутствует
в `apps/web/env.yaml`: браузер использует его для официальной кнопки Google.
Секретом это значение не является.

`AUTH_AVATAR_MAX_SOURCE_BYTES`, `AUTH_AVATAR_FETCH_TIMEOUT_MS` и
`AUTH_AVATAR_SIZE_PX` ограничивают загрузку и обработку внешних аватаров.
Сохранённые изображения отдаются уже с нашего сервера, поэтому клиенту не нужен
сетевой доступ к доменам OAuth-провайдеров.

### Клиент

Пример структуры:

```yaml
GOOGLE_CLIENT_ID: ''
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: ''
```

Адрес backend не является клиентской настройкой: браузер всегда обращается к
своему origin через `/api/*` и `/api/socket.io`. В development эти пути
проксирует Vite. В production `APP_SERVE_WEB: true` включает раздачу
`apps/web/dist` сервером, включая SPA fallback для deep links.

`__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` используется только development-
сервером Vite и не входит в `__WEB_CONFIG__`. Локально в нём можно указать
hostname HTTPS-туннеля; значение без схемы и пути попадает в
`server.allowedHosts`.

Клиентский YAML читается во время сборки Vite. Явные переменные команды сборки применяются после YAML и имеют наивысший приоритет. Любое итоговое значение оказывается доступным в браузере, поэтому в `apps/web/env.yaml`, `apps/web/env.local.yaml` и build-переменных клиента не должно быть секретов.

Переключатель backend отображается во всех development-сборках: до входа он
встроен в `/login`, а после входа доступен в dev-панели по кнопке `Dev` в
навигации. Недоступность real API не скрывает `/login` и переключатель. Вся
dev-механика удаляется из production-сборки через `import.meta.env.DEV`.

## Runtime feature flags

Единственный источник набора флагов находится в
`packages/feature-flags/feature-flags.json`:

```json
{
  "gameHistory": true,
  "optimisticMoves": false,
  "spectatorMode": true
}
```

Пакет `@war-chest/feature-flags` импортирует этот JSON и выводит из него тип
`RuntimeFeatureFlags`, строгую Zod-схему, исходные значения для fake-режима и
Server, web, game engine, API contracts, database seed и fake database используют
один и тот же тип. Поэтому добавление, удаление или переименование ключа сразу
меняет автодополнение и ошибки TypeScript во всех потребителях.

В файле находятся только boolean-значения. Секретов, адресов и числовых
параметров в нём нет. Изменение набора ключей является изменением контракта:
его делают в JSON, исправляют подсвеченные TypeScript места и выпускают вместе
с новой сборкой. Разные окружения не могут иметь разные наборы ключей.

### Как обновляется флаг

Deployment заменяет значения в том же полном JSON перед запуском server:

1. Система управления конфигурацией берёт полный список ключей из версии
   приложения.
2. Она подставляет boolean-значения нужного окружения без добавления и удаления
   ключей.
3. Готовый файл размещается как
   `packages/feature-flags/feature-flags.json`.
4. Server при каждом чтении проверяет полный snapshot строгой схемой.
5. Новая игра сохраняет проверенный snapshot в событии `GameCreated`.

Если значения меняются у уже запущенного server, файл сначала полностью пишется
под временным именем, а затем атомарно заменяет активный JSON. Это не даёт
server прочитать частично записанный документ.

Сервер не следит за файлом и не обновляет глобальное состояние в фоне. Чтение
происходит при запросе application flags и на границе создания игры. Уже
созданные игры продолжают использовать snapshot из `GameCreated`.

### Размещение файлов

Файл хранится в Git вместе с кодом и содержит безопасные локальные значения:

```text
packages/feature-flags/feature-flags.json
```

`apps/server/env.yaml` указывает на него через
`FEATURE_FLAGS_RUNTIME_FILE`. Deployment подменяет файл полным вариантом своего
окружения. Если экземпляров server несколько, каждый получает одинаковые
значения и тот же набор ключей из версии приложения.

## Helm и Kubernetes

Helm хорошо соответствует нашей модели конфигурации, но использовать его имеет смысл только вместе с Kubernetes. Он не является самостоятельной заменой Docker Compose или обычному запуску на виртуальной машине.

Если проект перейдёт на Kubernetes, структура может выглядеть так:

```text
deploy/helm/war-chest/
  Chart.yaml
  values.yaml
  values-dev.yaml
  values-production.yaml
  templates/
    server-configmap.yaml
    web-configmap.yaml
    feature-flags-configmap.yaml
    deployment.yaml
    service.yaml
```

Приоритет Helm values совпадает с требуемой моделью:

```text
values.yaml
  < values-<environment>.yaml, переданный через -f
  < параметры командной строки --set / --set-string / --set-file
```

`values-dev.yaml` и `values-production.yaml` содержат различия окружений. Разовые явные значения передаются через командную строку и имеют наивысший приоритет.

Feature-flags JSON можно передать в chart через `--set-file` и сформировать из
него Kubernetes ConfigMap. Init container или entrypoint проверяет, что ConfigMap
содержит ожидаемый набор ключей, и размещает файл по пути:

```text
packages/feature-flags/feature-flags.json
```

Значения ConfigMap можно менять без новой сборки образа, но deployment должен
перезапустить Pod, чтобы входной файл был размещён до запуска Node.js. Набор
ключей берётся из версии приложения и не настраивается через Helm values.

Для текущего MVP Kubernetes и Helm откладываем. Их стоит добавлять вместе, когда появится реальная потребность в Kubernetes: несколько экземпляров сервера, автоматическое восстановление Pod, единое управление окружениями или уже существующий кластер.

## Загрузка при инициализации приложения

Сервер предоставляет:

```text
GET /api/config/feature-flags.json
```

Endpoint при запросе читает runtime-файл активного окружения и проверяет его
строгой схемой из `@war-chest/feature-flags`. Snapshot должен содержать каждый
известный ключ ровно один раз, не иметь неизвестных ключей и состоять только из
boolean-значений.

OAuth-провайдеры не используют этот endpoint: кнопки Google, Telegram и Yandex
ID показываются без feature flags. Клиент получает игровые флаги из события
`GameCreated` или игрового snapshot. Когда у общего UI появятся отдельные
потребители application flags, они смогут загрузить текущий snapshot через этот
endpoint.

## Фиксация флагов в истории игры

При создании игры сервер:

1. Читает JSON активного окружения.
2. Добавляет snapshot флагов в доверенную команду `CreateGame`.
3. Формирует событие `GameCreated`.
4. Записывает полный snapshot флагов в payload события.
5. Сохраняет событие в `game_events`.
6. Передаёт те же значения клиенту вместе с созданной игрой.

Пример:

```json
{
  "type": "GameCreated",
  "payload": {
    "featureFlags": {
      "gameHistory": true,
      "optimisticMoves": false,
      "spectatorMode": true
    }
  }
}
```

После сохранения `GameCreated` runtime-файл больше не используется этой игрой:

- сервер проверяет поведение по `game.featureFlags`;
- клиент получает флаги из игрового snapshot;
- reconnect возвращает тот же набор;
- replay восстанавливает значения из события;
- замена файла окружения не меняет уже созданную игру;
- `GameStarted` использует флаги из состояния и не перечитывает runtime-файл.

Значения, загруженные при инициализации приложения, не используются как
источник игровых правил. В момент создания сервер независимо перечитывает файл,
поэтому новая игра получает актуальный snapshot даже в давно открытой вкладке.

## Dev-панель клиента

Dev-панель хранит через Zustand `persist` только выбор backend `real` или
`fake`. Локальных overrides игровых feature flags нет.

В fake-режиме application flags и snapshots игровых флагов хранятся в IndexedDB.
Изменение флагов выбранной fake-игры обновляет сохранённый `GameCreated`,
пересобирает состояние по событиям и рассылает подключённым вкладкам новый
snapshot. В real-режиме флаги доступны только для чтения.

Архитектура gateway, lazy loading fake-реализации и `packages/fake-database`
описана в разделе
[«Разработка клиента без сервера»](./client-development/README.md).

## Критерии готовности

- каждое приложение и инфраструктурный пакет читают собственный `env.yaml`;
- `DATABASE_URL` и параметры пула не дублируются в серверной конфигурации;
- локальные настройки базы читаются из `packages/database/env.local.yaml`;
- настройки провайдеров и сессии находятся в `packages/auth`;
- локальные секреты авторизации читаются из `packages/auth/env.local.yaml`;
- ограничения загрузки аватаров задаются в `packages/auth/env.yaml`;
- конфигурация содержит только плоские строки, числа и boolean-значения;
- вложенные объекты, массивы и deep merge отсутствуют;
- необязательный локальный YAML переопределяет основной и игнорируется Git;
- явно переданные build/start-переменные имеют наивысший приоритет;
- неверная конфигурация останавливает запуск или сборку;
- клиентские конфиги не содержат секретов;
- `packages/feature-flags/feature-flags.json` хранится в Git и задаёт набор
  ключей, типы и безопасные локальные значения;
- deployment меняет только boolean-значения и сохраняет полный набор ключей;
- сервер читает файл активного окружения для каждого запроса application flags
  и отдельно при создании игры;
- новый набор значений применяется к следующей создаваемой игре;
- сервер отклоняет пропущенные, неизвестные и не-boolean флаги;
- изменение ключа в JSON меняет `RuntimeFeatureFlags` и подсвечивает всех
  TypeScript-потребителей;
- OAuth-провайдеры не зависят от runtime feature flags;
- создание игры независимо перечитывает актуальный runtime-файл;
- `GameCreated` содержит полный snapshot feature flags;
- созданная игра не меняет флаги после замены runtime-файла;
- старт партии использует флаги из `GameState` и не читает runtime-файл;
- общий UI использует initialization snapshot;
- игровая механика использует флаги из события или игрового snapshot;
- dev-панель доступна в development-сборке без отдельного feature flag;
- выбор real/fake backend сохраняется в `localStorage`;
- локальные overrides игровых feature flags отсутствуют;
- fake feature flags хранятся в IndexedDB;
- real-режим не позволяет изменять игровые флаги через dev-панель.

## Полезные ссылки

- [Helm: Values Files и порядок приоритетов](https://helm.sh/docs/v3/chart_template_guide/values_files/)
- [Helm: передача файла через `--set-file`](https://helm.sh/docs/helm/helm_install/)
- [Kubernetes: обновление конфигурации через ConfigMap](https://kubernetes.io/docs/tutorials/configuration/updating-configuration-via-a-configmap/)
- [Kubernetes: ConfigMap volumes и ограничение `subPath`](https://kubernetes.io/docs/concepts/storage/volumes/#configmap)
