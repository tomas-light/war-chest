# OAuth-провайдеры

Все провайдеры приводят подтверждённый внешний профиль к одной структуре:
`provider`, стабильный `providerSubject`, отображаемое имя и необязательный URL
аватара. Email, username и login не используются как постоянный идентификатор.

## Google

`loginWithGoogle(idToken)` передаёт токен в `google-auth-library` и указывает
`GOOGLE_CLIENT_ID` как ожидаемую audience. Библиотека проверяет токен, после
чего пакет требует непустой claim `sub`.

Имя выбирается из `name`, затем `given_name`; если оба отсутствуют,
используется `Google user`. URL аватара берётся из `picture`.

## Telegram

`beginTelegramLogin()` создаёт случайные state и PKCE verifier, сохраняет их в
памяти экземпляра `Auth` и формирует authorization URL со следующими
параметрами:

- `response_type=code`;
- `scope=openid profile`;
- `code_challenge_method=S256`;
- client ID, redirect URI, state и PKCE challenge.

Сервер должен записать возвращённый state в подготовленную `HttpOnly`,
`SameSite=Lax` cookie. При callback пакет сравнивает state из URL и cookie,
одноразово извлекает PKCE verifier и отправляет authorization code на token
endpoint. Client ID и secret передаются через HTTP Basic authentication.

Полученный ID token проверяется по Telegram JWKS. Допускаются алгоритмы RS256 и
ES256; также проверяются issuer и audience. Непустой `sub` становится
`providerSubject`, а имя выбирается из `name`, `given_name`,
`preferred_username` или заменяется на `Telegram user`.

## Yandex ID

`beginYandexLogin()` создаёт тот же state и PKCE S256, но запрашивает scopes
`login:info login:avatar`.

При callback пакет одноразово проверяет state, обменивает code на access token с
HTTP Basic authentication и запрашивает профиль с заголовком
`Authorization: OAuth <access_token>`. Поле `client_id` профиля должно совпасть
с настроенным Yandex client ID. Поле `id` становится `providerSubject`, а имя
выбирается из `display_name`, `real_name`, `login` или заменяется на
`Yandex user`.

URL аватара формируется только при `is_avatar_empty === false` и наличии
`default_avatar_id`. Access token после чтения профиля не сохраняется.

## OAuth state и ошибки

State привязан к провайдеру, живёт указанное в
`AUTH_OAUTH_STATE_TTL_MINUTES` количество минут и удаляется при первой попытке
использования, даже если проверка завершилась ошибкой. Сравнение state с cookie
выполняется через timing-safe операцию.

Хранилище state находится в памяти конкретного объекта `Auth`. Незавершённый
flow не переживает перезапуск процесса и не доступен другому экземпляру
приложения.

Ожидаемые ошибки представлены `AuthError`:

| Код                       | Ситуация                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| `provider_disabled`       | У провайдера не настроены обязательные credentials                   |
| `invalid_oauth_state`     | State отсутствует, истёк, уже использован или не совпал с cookie     |
| `invalid_credentials`     | ID token или подтверждённый профиль не прошёл проверку               |
| `provider_request_failed` | Запрос провайдера, JSON или структура ответа оказались некорректными |

HTTP-адаптер самостоятельно сопоставляет эти коды со статусами и телами
ответов.
