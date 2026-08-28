# Конфигурация авторизации

`loadAuthConfig()` использует общий загрузчик из `@war-chest/config` и затем
проверяет результат Zod-схемой пакета. Значения объединяются в таком порядке:

1. обязательный `packages/auth/env.yaml`;
2. необязательный `packages/auth/env.local.yaml`;
3. известные пакету переменные процесса.

Каждый следующий источник переопределяет предыдущий. Неизвестные ключи в YAML,
вложенные YAML-объекты и значения неподходящего типа приводят к ошибке при
загрузке. Из переменных процесса читаются только известные ключи.
`env.local.yaml` предназначен для локальных client ID и secrets и исключён из
Git.

## Сессия и redirect

| Ключ                           | Назначение                                                         |
| ------------------------------ | ------------------------------------------------------------------ |
| `AUTH_SESSION_COOKIE_NAME`     | Имя cookie собственной сессии и префикс OAuth state cookie         |
| `AUTH_SESSION_TTL_MINUTES`     | Срок действия сессии и session cookie в минутах                    |
| `AUTH_OAUTH_STATE_TTL_MINUTES` | Срок действия OAuth state и его cookie в минутах                   |
| `AUTH_COOKIE_SECURE`           | Атрибут `Secure` у session и OAuth state cookie                    |
| `AUTH_COOKIE_SAME_SITE`        | `SameSite` только у session cookie                                 |
| `AUTH_SUCCESS_REDIRECT_URL`    | Адрес, на который HTTP-адаптер направляет пользователя после входа |

При ошибке Telegram или Yandex redirect flow сервер сохраняет origin этого
адреса, но направляет браузер на `/login?authError=<code>`. Страница входа
переводит стабильный код ошибки на выбранный пользователем язык.

`AUTH_COOKIE_SAME_SITE: none` допустим только вместе с
`AUTH_COOKIE_SECURE: true`. Пакет подготавливает cookie, но устанавливает её в
HTTP-ответ сервер.

## Аватары

| Ключ                           | Назначение                                       |
| ------------------------------ | ------------------------------------------------ |
| `AUTH_AVATAR_MAX_SOURCE_BYTES` | Максимальный размер загружаемого исходного файла |
| `AUTH_AVATAR_FETCH_TIMEOUT_MS` | Таймаут одного HTTP-запроса изображения          |
| `AUTH_AVATAR_SIZE_PX`          | Ширина и высота сохранённого квадратного WebP    |

Независимо от конфигурации декодируемое исходное изображение ограничено
`512 × 512` пикселями.

## Провайдеры

Кнопки Google, Telegram и Yandex ID отображаются на `/login` без runtime feature
flags. Готовность real-входа определяет конфигурация провайдера: при пустых
обязательных credentials сервер возвращает `provider_disabled`.

Google использует `GOOGLE_CLIENT_ID` как ожидаемую audience ID token.

Telegram использует:

- `TELEGRAM_CLIENT_ID` и `TELEGRAM_CLIENT_SECRET`;
- `TELEGRAM_AUTHORIZATION_ENDPOINT` и `TELEGRAM_TOKEN_ENDPOINT`;
- `TELEGRAM_ISSUER` и `TELEGRAM_JWKS_ENDPOINT`;
- `TELEGRAM_REDIRECT_URI`.

Client ID и Client Secret выдаёт OIDC-конфигурация Web Login в Mini App
BotFather. После изменения credentials или redirect URI нужно перезапустить
server: auth-конфигурация читается при создании сервиса. Проверенный сценарий с
HTTPS-туннелем описан в
[локальном входе через Telegram](./telegram-local-development.md).

Yandex использует:

- `YANDEX_CLIENT_ID` и `YANDEX_CLIENT_SECRET`;
- `YANDEX_AUTHORIZATION_ENDPOINT` и `YANDEX_TOKEN_ENDPOINT`;
- `YANDEX_PROFILE_ENDPOINT`;
- `YANDEX_REDIRECT_URI`.

URL проходят проверку как `http:` или `https:`. Client ID и secrets могут быть
пустыми в общей конфигурации: пакет создаётся, но попытка использовать
соответствующего провайдера завершается ошибкой `provider_disabled`.
