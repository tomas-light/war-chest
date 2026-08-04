# Фактическое поведение Socket.IO

Socket.IO подключён к тому же HTTP server, что и Fastify, и использует путь
`/api/socket.io`. Раздача Socket.IO client bundle отключена.

## Authentication handshake

При каждом новом соединении server:

1. разбирает cookie из handshake;
2. ищет session cookie с именем из `@war-chest/auth`;
3. вызывает `auth.getSession`;
4. отклоняет соединение с `Authentication is required.`, если сессии нет;
5. сохраняет `session.user.id` в `socket.data.userId`.

Исключение авторизации отклоняет handshake с исходной ошибкой либо сообщением
`Authentication failed.`.

## Сообщения клиента

Payload каждого сообщения проверяется Zod-схемой из
`@war-chest/api-contracts`.

| Событие        | Текущее поведение                                        |
| -------------- | -------------------------------------------------------- |
| `game:join`    | валидирует `gameId` и добавляет socket в `game:<gameId>` |
| `game:leave`   | валидирует `gameId` и удаляет socket из комнаты          |
| `game:sync`    | только валидирует `gameId` и `afterSequence`             |
| `game:command` | только валидирует command envelope                       |

Некорректный payload получает `game:error`:

```json
{
  "code": "invalid_message",
  "gameId": null,
  "message": "Invalid game:join message."
}
```

## Сообщения сервера

Контракты описывают `game:snapshot`, `game:events` и `game:error`, однако
текущая server-реализация самостоятельно отправляет только `game:error` для
невалидного входного сообщения.

Валидные `game:sync` и `game:command` сейчас не вызывают business logic и не
получают acknowledgment. Join не загружает snapshot. Это намеренно неполный
transport scaffold, а не готовый игровой server.

## Завершение работы

При закрытии Fastify server закрывает Socket.IO и ждёт callback. После этого
общий lifecycle также закрывает database connection.
