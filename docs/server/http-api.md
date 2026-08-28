# Фактический HTTP API

Все маршруты server находятся под `/api`. Неизвестный API URL всегда получает
JSON 404 и не попадает в SPA fallback.

## Реализованные endpoints

| Метод  | URL                                 | Авторизация | Поведение                            |
| ------ | ----------------------------------- | ----------- | ------------------------------------ |
| `GET`  | `/api/health`                       | нет         | проверяет соединение с PostgreSQL    |
| `POST` | `/api/auth/google`                  | нет         | проверяет Google ID token            |
| `GET`  | `/api/auth/telegram/start`          | нет         | начинает Telegram OAuth flow         |
| `GET`  | `/api/auth/telegram/callback`       | state       | завершает Telegram OAuth flow        |
| `GET`  | `/api/auth/yandex/start`            | нет         | начинает Yandex OAuth flow           |
| `GET`  | `/api/auth/yandex/callback`         | state       | завершает Yandex OAuth flow          |
| `GET`  | `/api/auth/session`                 | session     | возвращает текущую сессию            |
| `POST` | `/api/auth/logout`                  | нестрогая   | отзывает сессию и очищает cookie     |
| `GET`  | `/api/games`                        | session     | возвращает активные игры для лобби   |
| `POST` | `/api/games`                        | session     | создаёт игру                         |
| `GET`  | `/api/games/:gameId`                | session     | возвращает безопасный snapshot       |
| `POST` | `/api/games/:gameId/join`           | session     | занимает или меняет позицию игрока   |
| `POST` | `/api/games/:gameId/start`          | session     | запускает заполненную игру           |
| `POST` | `/api/games/:gameId/swap-positions` | session     | меняет местами двух игроков          |
| `GET`  | `/api/games/:gameId/events`         | session     | возвращает безопасный хвост истории  |
| `GET`  | `/api/users/:userId`                | session     | возвращает публичный профиль         |
| `GET`  | `/api/users/:userId/avatar`         | session     | возвращает сохранённый avatar binary |
| `GET`  | `/api/users/:userId/games`          | session     | возвращает страницу завершённых игр  |
| `GET`  | `/api/config/feature-flags.json`    | нет         | возвращает текущие runtime flags     |

## Игровой API

Все игровые маршруты требуют действующую session cookie. `userId` берётся
только из сессии; body не принимает identity или feature flags. `gameId` и
`commandId` должны быть UUID, версии и `afterSequence` — неотрицательными
целыми числами.

`POST /api/games` принимает только `commandId`. Он создаёт пустую игру без
участников: создатель выбирает место отдельной командой после перехода на
страницу игры и до этого остаётся зрителем. Новая игра отвечает `201`, exact
duplicate — `200` с тем же `gameId` и актуальным безопасным view. Server сначала
проверяет, не был ли `commandId` уже обработан. Exact duplicate возвращается без
чтения runtime feature flags, поэтому повтор успешного запроса не зависит от
текущей доступности файла. Только новая команда читает flags и сохраняет их
snapshot в единственном событии `GameCreated`.

`GET /api/games` возвращает незавершённые игры для лобби от новых к старым:

```json
{
  "currentPlayerGameId": null,
  "items": [
    {
      "createdAt": "2026-08-28T10:00:00.000Z",
      "id": "00000000-0000-4000-8000-000000000001",
      "players": [
        {
          "avatarVersion": null,
          "displayName": "Player",
          "id": "00000000-0000-4000-8000-000000000002",
          "seat": 1,
          "team": "white"
        }
      ],
      "startedAt": null,
      "status": "waiting"
    }
  ]
}
```

`currentPlayerGameId` содержит незавершённую игру, в которой текущий
пользователь занимает место, либо `null`. Пока значение не `null`, создание
новой игры и `JoinGame` в другой игре отклоняются; наблюдение за любым числом
параллельных матчей остаётся доступным.

Ожидающую игру со свободным местом можно открыть двумя отдельными действиями:
для наблюдения или для выбора места. Если оба места заняты, до старта доступно
только наблюдение. Активная игра всегда открывается постороннему пользователю
как зрителю. Зритель не становится участником и не получает приватную часть
состояния.

`POST /api/games/:gameId/join` принимает `commandId`, `expectedVersion`, `seat`
и `team`. Для зрителя команда занимает свободное место и создаёт
`PlayerJoined`. Участник может той же командой перейти на другую свободную
позицию до заполнения игры; тогда создаётся `PlayerPositionChanged`, а SQL-
проекция участника обновляется. Повторный join на текущую позицию возвращает
актуальное view без нового события. Чужая занятая позиция возвращает
`game_position_occupied`. Остальные игровые команды доступны только игрокам, а
не зрителям. `POST /api/games/:gameId/start` принимает `commandId` и
`expectedVersion`; выполнить его может только создатель. Тот же body принимает
`POST /api/games/:gameId/swap-positions`: до старта создатель одной командой
обменивает позиции двух уже присоединившихся игроков.

`GET /api/games/:gameId` возвращает полный персональный snapshot.
`GET /api/games/:gameId/events?afterSequence=N` возвращает безопасные события
со строго большим sequence; без query история начинается с первого события.
Игрок в snapshot содержит `presence` и nullable ISO `reconnectDeadline`.
Presence-события доступны в том же безопасном event tail, что и игровые
события.

Ожидаемые игровые ошибки:

| Код                         | HTTP | Ситуация                                       |
| --------------------------- | ---- | ---------------------------------------------- |
| `invalid_request`           | 400  | params, query или body не прошли Zod           |
| `unauthorized`              | 401  | нет действующей сессии                         |
| `game_command_forbidden`    | 403  | пользователь не может выполнить команду        |
| `game_not_found`            | 404  | игра с корректным UUID не найдена              |
| `game_position_occupied`    | 409  | выбранная позиция уже занята                   |
| `player_already_in_game`    | 409  | пользователь уже играет в другой партии        |
| `game_version_conflict`     | 409  | клиентская версия устарела                     |
| `command_id_conflict`       | 409  | UUID команды принадлежит другому запросу       |
| `game_command_rejected`     | 422  | команда отклонена игровыми правилами           |
| `feature_flags_unavailable` | 503  | новый create не прочитал runtime feature flags |

## Runtime feature flags

`GET /api/config/feature-flags.json` при каждом запросе заново читает файл из
`FEATURE_FLAGS_RUNTIME_FILE`. Полный набор ключей задаёт
`packages/feature-flags/feature-flags.json`; значения всех флагов имеют тип
`boolean`. Успешный ответ получает `Cache-Control: no-store`, чтобы новая
загрузка приложения не использовала устаревший HTTP cache:

```json
{
  "myPageEnabled": true,
  "newDrawerEnabled": false
}
```

Окружения могут менять значения, но не набор ключей. Если файл отсутствует,
содержит некорректный JSON, не является объектом, пропускает известный ключ,
добавляет неизвестный ключ или включает не-boolean значение, endpoint отвечает
`503 feature_flags_unavailable`.

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

Ошибки `POST /api/auth/google` возвращаются в едином API envelope. Ошибка
redirect flow перенаправляет браузер на `/login?authError=<code>` относительно
origin из `AUTH_SUCCESS_REDIRECT_URL`: клиент переводит стабильный код и не
показывает техническое сообщение сервера.

| Код                       | Google HTTP | Redirect flow | Ситуация                                    |
| ------------------------- | ----------- | ------------- | ------------------------------------------- |
| `invalid_request`         | 400         | `302 /login`  | callback не содержит обязательные параметры |
| `invalid_credentials`     | 401         | `302 /login`  | провайдер не подтвердил credentials         |
| `invalid_oauth_state`     | 400         | `302 /login`  | OAuth state недействителен или истёк        |
| `provider_disabled`       | 503         | `302 /login`  | credentials провайдера не настроены         |
| `provider_request_failed` | 502         | `302 /login`  | запрос внешнего провайдера завершился сбоем |

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
