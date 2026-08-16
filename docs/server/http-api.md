# Фактический HTTP API

Все маршруты server находятся под `/api`. Неизвестный API URL всегда получает
JSON 404 и не попадает в SPA fallback.

## Реализованные endpoints

| Метод  | URL                              | Авторизация | Поведение                            |
| ------ | -------------------------------- | ----------- | ------------------------------------ |
| `GET`  | `/api/health`                    | нет         | проверяет соединение с PostgreSQL    |
| `POST` | `/api/auth/google`               | нет         | проверяет Google ID token            |
| `GET`  | `/api/auth/telegram/start`       | нет         | начинает Telegram OAuth flow         |
| `GET`  | `/api/auth/telegram/callback`    | state       | завершает Telegram OAuth flow        |
| `GET`  | `/api/auth/yandex/start`         | нет         | начинает Yandex OAuth flow           |
| `GET`  | `/api/auth/yandex/callback`      | state       | завершает Yandex OAuth flow          |
| `GET`  | `/api/auth/session`              | session     | возвращает текущую сессию            |
| `POST` | `/api/auth/logout`               | нестрогая   | отзывает сессию и очищает cookie     |
| `GET`  | `/api/users/:userId`             | session     | возвращает публичный профиль         |
| `GET`  | `/api/users/:userId/avatar`      | session     | возвращает сохранённый avatar binary |
| `GET`  | `/api/users/:userId/games`       | session     | возвращает страницу завершённых игр  |
| `GET`  | `/api/config/feature-flags.json` | нет         | возвращает текущие runtime flags     |

Game endpoints из development plan пока не зарегистрированы.

## Runtime feature flags

`GET /api/config/feature-flags.json` при каждом запросе заново читает файл из
`FEATURE_FLAGS_RUNTIME_FILE`. Ответ — JSON-объект с произвольными ключами и
только boolean-значениями. Успешный ответ получает `Cache-Control: no-store`,
чтобы новая загрузка приложения не использовала устаревший HTTP cache:

```json
{
  "gameHistory": true,
  "spectatorMode": false
}
```

Список ключей не зашит в сервер и может различаться между окружениями. Если
файл отсутствует, содержит некорректный JSON, не является объектом или включает
не-boolean значение, endpoint отвечает `503 feature_flags_unavailable`.

## Health

Успешная проверка:

```json
{
  "status": "ok"
}
```

Если database check завершается ошибкой, endpoint отвечает `503`:

```json
{
  "status": "unavailable"
}
```

## Вход через провайдеров

`POST /api/auth/google` принимает JSON `{ "idToken": "..." }`. После успешной
проверки server устанавливает session cookie и возвращает тот же
`SessionResponse`, что и `/api/auth/session`.

Telegram и Yandex используют redirect flow. Маршрут `/start` получает URL и
OAuth state из `@war-chest/auth`, устанавливает подготовленную state cookie и
отвечает `302` на страницу провайдера. Callback требует непустые `code` и
`state`, передаёт их вместе со state cookie в пакет авторизации, очищает state
cookie, устанавливает session cookie и перенаправляет браузер на
`AUTH_SUCCESS_REDIRECT_URL`.

Ожидаемые ошибки пакета переводятся в единый API envelope:

| Код                       | HTTP | Ситуация                                    |
| ------------------------- | ---- | ------------------------------------------- |
| `invalid_credentials`     | 401  | провайдер не подтвердил credentials         |
| `invalid_oauth_state`     | 400  | OAuth state недействителен или истёк        |
| `provider_disabled`       | 503  | credentials провайдера не настроены         |
| `provider_request_failed` | 502  | запрос внешнего провайдера завершился сбоем |

Все ответы auth endpoints используют `Cache-Control: no-store`.

## Session и logout

`GET /api/auth/session` требует cookie с именем из конфигурации
`@war-chest/auth`. Действующая сессия возвращается с `Cache-Control: no-store`:

```json
{
  "expiresAt": "2026-08-04T20:00:00.000Z",
  "user": {
    "avatarVersion": null,
    "displayName": "Player",
    "id": "00000000-0000-0000-0000-000000000000"
  }
}
```

Отсутствующая или неизвестная сессия получает `401` с ошибкой
`unauthorized`.

`POST /api/auth/logout` можно вызвать без cookie или повторно. Server передаёт
токен либо пустую строку в `auth.logout`, устанавливает подготовленную пакетом
очищающую cookie и отвечает `204` без body. Ответ также использует
`Cache-Control: no-store`.

## Публичный профиль и avatar

Все user endpoints требуют действующую сессию, но позволяют читать другого
пользователя. `userId` должен быть UUID; иначе возвращается `400 invalid_request`.

Публичный профиль содержит только `id`, `displayName` и `avatarVersion`.
Внешние OAuth identifiers в ответ не попадают.

Avatar загружается из `@war-chest/auth`. Успешный ответ получает сохранённый
`Content-Type` и:

```text
Cache-Control: private, max-age=31536000, immutable
```

Если пользователя или avatar нет, server отвечает `404` с кодом
`user_not_found` или `avatar_not_found` соответственно.

## История завершённых игр

`GET /api/users/:userId/games` возвращает только завершённые игры, в которых
пользователь был игроком. Сортировка идёт по `finishedAt`, затем по `gameId`, от
новых значений к старым.

Query parameters:

- `limit` — целое число от 1 до 100, по умолчанию 20;
- `cursor` — opaque base64url JSON, возвращённый предыдущей страницей.

Ответ содержит `items` и `nextCursor`. В каждом item находятся время
завершения, участники, команда пользователя, победившая команда и вычисленный
`victory`/`defeat`. Некорректные параметры получают `400 invalid_request`, а
некорректный cursor — `400 invalid_cursor`.

## Формат ошибок

Прикладные ошибки имеют общий envelope:

```json
{
  "error": {
    "code": "user_not_found",
    "message": "User was not found."
  }
}
```
