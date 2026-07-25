# Авторизация

Для MVP пользователь входит через Google или Telegram. После проверки внешнего провайдера сервер создаёт собственную сессию War Chest — дальнейшая работа игры не зависит от того, каким способом пользователь вошёл.

Пароли и собственная регистрация в MVP не нужны.

## Общая модель

В базе разделяем пользователя и его внешние идентичности:

```text
users
  id
  display_name
  avatar_url
  created_at

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

Пара `(provider, provider_subject)` уникальна. Email или Telegram username не используются как постоянный идентификатор и не служат основанием для автоматического объединения аккаунтов.

Связывание Google и Telegram с одним существующим пользователем можно добавить позже как отдельное подтверждаемое действие.

## Сессия War Chest

После успешного входа сервер:

1. Проверяет ответ провайдера.
2. Находит или создаёт `user_identity`.
3. Находит или создаёт пользователя.
4. Создаёт собственную сессию.
5. Устанавливает случайный session token в `HttpOnly`, `Secure`, `SameSite` cookie.

В базе хранится только безопасный хеш session token. Та же cookie используется для HTTP и Socket.IO. Сервер проверяет сессию при каждом новом Socket.IO-соединении.

## Google

На клиенте используем официальный Sign in with Google button из Google Identity Services. Клиент получает Google ID token и отправляет его серверу:

```text
POST /auth/google
```

Сервер проверяет подпись, issuer, audience и срок действия токена, после чего создаёт сессию War Chest. Google отвечает только за момент входа; жизненным циклом нашей сессии управляет сервер.

Google client ID указывается и в публичной конфигурации клиента, и в серверной конфигурации ожидаемой audience. Секреты Google в клиент не передаются.

## Telegram

Используем актуальный Telegram OpenID Connect, а не устаревший iframe Login Widget:

- Authorization Code Flow;
- PKCE S256;
- scopes `openid profile`;
- серверная проверка подписи ID token через Telegram JWKS;
- проверка `iss`, `aud` и `exp`.

Маршруты:

```text
GET /auth/telegram/start
GET /auth/telegram/callback
```

`/start` создаёт `state`, PKCE verifier и перенаправляет пользователя в Telegram. Callback проверяет `state`, обменивает код на токены, валидирует ID token и создаёт сессию War Chest.

Телефон и разрешение боту отправлять сообщения для MVP не запрашиваем: для входа достаточно `openid profile`.

Telegram client ID и secret выдаются через BotFather. Secret хранится только в серверном `env.local.yaml` или в смонтированном production-конфиге.

## HTTP API

Итоговый набор маршрутов:

```text
POST /auth/google
GET  /auth/telegram/start
GET  /auth/telegram/callback
GET  /auth/session
POST /auth/logout
```

## Критерии готовности

- новый пользователь может войти через Google;
- новый пользователь может войти через Telegram;
- повторный вход находит существующую внешнюю идентичность;
- приложение создаёт собственную серверную сессию;
- logout отзывает сессию;
- Socket.IO отклоняет соединение без действующей сессии;
- идентичности разных провайдеров не объединяются автоматически;
- секреты провайдеров не попадают в клиентскую сборку.

## Полезные ссылки

- [Google Identity Services: интеграция](https://developers.google.com/identity/gsi/web/guides/integrate)
- [Telegram Login и OpenID Connect](https://core.telegram.org/bots/telegram-login)
