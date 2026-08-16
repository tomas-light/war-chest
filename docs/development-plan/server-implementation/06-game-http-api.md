# Этап 6. Игровой HTTP API

Цель этапа — предоставить защищённые HTTP-сценарии создания и первичного входа
в игру. Routes остаются тонкими: Zod validation, `requireAuthSession`, вызов
`GameService` и единое отображение ошибок.

## Сначала обновить api-contracts

В `@war-chest/api-contracts` добавить типы и строгие Zod-схемы request/response.
Все `gameId`, `commandId` и user ID — UUID. Клиент передаёт `commandId` для
каждой изменяющей операции, но никогда не передаёт feature flags или user ID.

| Метод | URL                         | Body                                                         | Успех                    |
| ----- | --------------------------- | ------------------------------------------------------------ | ------------------------ |
| POST  | `/api/games`                | `{ commandId }`                                              | `201 { gameId, view }`   |
| GET   | `/api/games/:gameId`        | —                                                            | `200 { gameId, view }`   |
| POST  | `/api/games/:gameId/join`   | `{ commandId, expectedVersion, seat, team }`                 | `200 { gameId, view }`   |
| POST  | `/api/games/:gameId/start`  | `{ commandId, expectedVersion }`                             | `200 { gameId, view }`   |
| GET   | `/api/games/:gameId/events` | query `afterSequence`, необязательный, неотрицательное целое | `200 { events, gameId }` |

Создание не принимает `expectedVersion`: первая версия появляется вместе с
`GameCreated`. Join и start используют текущий sequence, показанный клиенту.

## Авторизация и роли

Все маршруты требуют `requireAuthSession`. Identity берётся только из
`request.authSession.user.id`. GET доступен игроку и авторизованному зрителю;
неучастник не получает строку в `game_participants`. Join создаёт участие
игрока. Повторный join того же пользователя возвращает существующее участие и
не позволяет сменить позицию вторым запросом.

## Ошибки

| HTTP | Код                         | Ситуация                                     |
| ---- | --------------------------- | -------------------------------------------- |
| 400  | `invalid_request`           | body, params или query не прошли Zod         |
| 401  | `unauthorized`              | нет действующей сессии                       |
| 403  | `game_command_forbidden`    | роль не позволяет операцию                   |
| 404  | `game_not_found`            | UUID корректен, но игры нет                  |
| 409  | `game_position_occupied`    | выбранное место занято                       |
| 409  | `game_version_conflict`     | `expectedVersion` устарел                    |
| 422  | `game_command_rejected`     | engine отклонил доменно некорректную команду |
| 503  | `feature_flags_unavailable` | create не смог прочитать runtime flags       |

Duplicate `commandId` не является ошибкой: endpoint возвращает уже достигнутое
актуальное состояние с `200` (для повторного create допустим `200`, не `201`).

## Проверки этапа

- все endpoints требуют session и не доверяют user ID из body;
- UUID и числовые границы проверяются до service;
- create не принимает flags и использует client commandId;
- duplicate create возвращает тот же gameId;
- duplicate join/start не выполняет команду повторно;
- ошибки service стабильно переводятся в HTTP contract;
- response содержит только безопасный `GameView`/`GameViewEventData`;
- фактический API документирован в `docs/server/http-api.md`.
