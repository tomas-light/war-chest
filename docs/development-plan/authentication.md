# Авторизация

Для MVP пользователь входит через Google, Telegram или Yandex ID. После проверки внешнего провайдера сервер создаёт собственную сессию War Chest — дальнейшая работа игры не зависит от того, каким способом пользователь вошёл.

Пароли и собственная регистрация в MVP не нужны.

Пакет `@war-chest/auth` реализован. Его фактический публичный API, ограничения
и поведение описаны в разделе [«Авторизация»](../auth/README.md). HTTP-маршруты
Fastify, установка подготовленных cookie в ответ и проверка Socket.IO-соединений
остаются частью серверного этапа.

## Пакет `packages/auth`

Серверную реализацию авторизации выделяем в отдельный workspace-пакет. Так
интеграции с провайдерами, создание сессии и их конфигурация образуют одну
границу и не смешиваются с игровыми маршрутами Fastify.

```text
packages/auth/
  env.yaml
  env.local.yaml
  src/
    config/
      load-config.ts
      schema.ts
    providers/
      google.ts
      telegram.ts
      yandex.ts
    avatars.ts
    identities.ts
    sessions.ts
    index.ts
  package.json
  tsconfig.json
```

`packages/auth` содержит:

- проверку ответов Google, Telegram и Yandex ID;
- OAuth state, PKCE и обмен authorization code на токены;
- нормализацию профиля провайдера во внутреннюю внешнюю идентичность;
- загрузку и нормализацию аватара провайдера;
- создание, проверку и отзыв сессии War Chest;
- работу с session cookie через настройки пакета;
- публичный API, который вызывают HTTP-адаптеры сервера.

Пакет является серверным и не импортируется в браузерную сборку. Маршруты
Fastify остаются в `apps/server`, но только преобразуют HTTP-запрос в вызов
`@war-chest/auth` и устанавливают подготовленную пакетом cookie.

Таблицы `users`, `user_identities` и `auth_sessions` по-прежнему описаны в
`packages/database`. Пакет авторизации зависит от `@war-chest/database`, а пакет
базы ничего не знает об OAuth-провайдерах.

Конфигурация также принадлежит этой границе:

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

`packages/auth/env.yaml` хранится в Git с безопасными значениями и пустыми
секретами. Локальные client ID и secrets находятся в
`packages/auth/env.local.yaml`, который игнорируется Git. На стендах значения
передаются процессу явно и имеют наивысший приоритет.

Публичный Google client ID дополнительно остаётся в `apps/web/env.yaml`, потому
что он нужен официальной кнопке в браузере. Это не секрет. Telegram и Yandex
начинают redirect flow через сервер, поэтому их client ID клиентской сборке не
нужны.

## Общая модель

В базе разделяем пользователя и его внешние идентичности:

```text
users
  id
  display_name
  created_at

user_avatars
  user_id
  content
  content_type
  content_hash
  updated_at

user_identities
  id
  user_id
  provider
  provider_subject
  created_at

auth_sessions
  id
  user_id
  expires_at
  created_at
  revoked_at
```

Пара `(provider, provider_subject)` уникальна. Email, Telegram username или
Yandex login не используются как постоянный идентификатор и не служат
основанием для автоматического объединения аккаунтов.

Связывание идентичностей разных провайдеров с одним существующим пользователем
можно добавить позже как отдельное подтверждаемое действие.

## Аватар пользователя

URL аватара внешнего провайдера в профиле не сохраняем и не отдаём клиенту.
Иначе доступность изображения будет зависеть от того, может ли браузер другого
игрока обратиться к Telegram, Google или Yandex.

Во время успешного входа `packages/auth`:

1. Получает адрес или данные аватара из проверенного ответа провайдера.
2. Загружает изображение на сервере с ограничением времени и размера ответа.
3. Проверяет, что полученный файл является поддерживаемым изображением.
4. Уменьшает его до размера `AUTH_AVATAR_SIZE_PX` и сохраняет в едином формате.
5. Записывает бинарные данные и hash в `user_avatars`.

Сервер не загружает произвольный URL, переданный пользователем. Каждый provider
adapter принимает аватар только из доверенного ответа своего провайдера и не
разрешает переходы на локальные или внутренние сетевые адреса.

При повторном входе сохранённая копия обновляется, если изображение изменилось.
Если провайдер не вернул аватар или его загрузка завершилась ошибкой, вход всё
равно продолжается: существующий аватар остаётся без изменений, а для нового
пользователя клиент показывает локальную заглушку.

Клиент получает не внешний адрес, а URL нашего API:

```text
GET /api/users/:userId/avatar?v=<contentHash>
```

Маршрут требует действующую сессию и возвращает изображение из PostgreSQL.
`contentHash` меняется вместе с аватаром, поэтому ответ можно кэшировать как
immutable, не показывая старое изображение после следующего входа пользователя.

## Сессия War Chest

После успешного входа сервер:

1. Проверяет ответ провайдера.
2. Находит или создаёт `user_identity`.
3. Находит или создаёт пользователя.
4. Создаёт собственную сессию.
5. Устанавливает случайный session token в `HttpOnly`, `SameSite=Lax` cookie.

В dev и production cookie также получает атрибут `Secure`. Для локального
callback по обычному `http://localhost` значение `AUTH_COOKIE_SECURE` равно
`false`. В базе хранится только безопасный хеш session token. Та же cookie
используется для HTTP и Socket.IO. Сервер проверяет сессию при каждом новом
Socket.IO-соединении.

## Google

На клиенте используем официальный Sign in with Google button из Google Identity Services. Клиент получает Google ID token и отправляет его серверу:

```text
POST /api/auth/google
```

Сервер проверяет подпись, issuer, audience и срок действия токена, после чего создаёт сессию War Chest. Google отвечает только за момент входа; жизненным циклом нашей сессии управляет сервер.

Google client ID указывается и в публичной конфигурации клиента, и в
`packages/auth` как ожидаемая audience. Секреты Google в клиент не передаются.

## Telegram

Используем актуальный Telegram OpenID Connect, а не устаревший iframe Login Widget:

- Authorization Code Flow;
- PKCE S256;
- scopes `openid profile`;
- серверная проверка подписи ID token через Telegram JWKS;
- проверка `iss`, `aud` и `exp`.

Маршруты:

```text
GET /api/auth/telegram/start
GET /api/auth/telegram/callback
```

`/start` создаёт `state`, PKCE verifier и перенаправляет пользователя в Telegram. Callback проверяет `state`, обменивает код на токены, валидирует ID token и создаёт сессию War Chest.

Телефон и разрешение боту отправлять сообщения для MVP не запрашиваем: для входа достаточно `openid profile`.

Telegram client ID и secret выдаются через BotFather. Локально secret находится
в `packages/auth/env.local.yaml`. На стендах он передаётся явно процессу запуска
или через Kubernetes Secret, если проект перейдёт на Kubernetes.

## Yandex ID

Используем серверный OAuth 2.0 Authorization Code Flow:

- `state` для защиты от CSRF;
- PKCE S256;
- серверный обмен кода на OAuth-токен;
- получение профиля через API Yandex ID;
- `id` из ответа Yandex ID как `provider_subject`;
- удаление OAuth-токена после создания собственной сессии War Chest.

Маршруты:

```text
GET /api/auth/yandex/start
GET /api/auth/yandex/callback
```

Yandex OAuth можно использовать при разработке на localhost. В настройках
OAuth-приложения добавляем отдельный Redirect URI:

```text
http://localhost:5173/api/auth/yandex/callback
```

Redirect URI из запроса должен совпадать с зарегистрированным по схеме, хосту,
порту и пути. Поэтому `localhost` нельзя незаметно заменить на `127.0.0.1`, а
другой порт нужно зарегистрировать отдельным адресом. Одно OAuth-приложение
может иметь несколько Redirect URI для localhost, dev и production.

После callback пакет обменивает code на токен, запрашивает профиль через
`https://login.yandex.ru/info` с токеном в заголовке `Authorization`, создаёт
сессию War Chest и перенаправляет браузер на `AUTH_SUCCESS_REDIRECT_URL`.
OAuth-токен Yandex не отправляется клиенту и не сохраняется как сессия игры.

## HTTP API

Итоговый набор маршрутов:

```text
POST /api/auth/google
GET  /api/auth/telegram/start
GET  /api/auth/telegram/callback
GET  /api/auth/yandex/start
GET  /api/auth/yandex/callback
GET  /api/auth/session
POST /api/auth/logout
GET  /api/users/:userId/avatar
```

## Критерии готовности

- новый пользователь может войти через Google;
- новый пользователь может войти через Telegram;
- новый пользователь может войти через Yandex ID;
- Yandex login работает через зарегистрированный localhost callback;
- повторный вход находит существующую внешнюю идентичность;
- приложение создаёт собственную серверную сессию;
- logout отзывает сессию;
- Socket.IO отклоняет соединение без действующей сессии;
- идентичности разных провайдеров не объединяются автоматически;
- клиент никогда не загружает аватар напрямую с домена провайдера;
- аватар сохраняется в PostgreSQL и доступен через API War Chest;
- ошибка обновления аватара не блокирует вход и не удаляет прежнюю копию;
- реализация провайдеров и сессий находится в `packages/auth`;
- пакет авторизации читает собственные `env.yaml` и необязательный `env.local.yaml`;
- секреты провайдеров не попадают в клиентскую сборку.

## Полезные ссылки

- [Google Identity Services: интеграция](https://developers.google.com/identity/gsi/web/guides/integrate)
- [Telegram Login и OpenID Connect](https://core.telegram.org/bots/telegram-login)
- [Yandex ID: регистрация приложения и Redirect URI](https://yandex.ru/dev/id/doc/ru/register-auth)
- [Yandex ID: Authorization Code Flow и PKCE](https://yandex.ru/dev/id/doc/ru/codes/code-url)
- [Yandex ID: получение профиля пользователя](https://yandex.ru/dev/id/doc/ru/user-information)
