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

| Событие        | Текущее поведение                                                     |
| -------------- | --------------------------------------------------------------------- |
| `game:join`    | подключает runtime connection, входит в комнату и отправляет snapshot |
| `game:leave`   | удаляет runtime connection и выходит из комнаты                       |
| `game:sync`    | отправляет безопасный event tail либо полный snapshot                 |
| `game:command` | выполняет команду; сохранённое обновление публикует `GameService`     |

Некорректный payload получает `game:error`:

```json
{
  "code": "invalid_message",
  "gameId": null,
  "message": "Invalid game:join message."
}
```

## Сообщения сервера

`game:snapshot` содержит полный `GameView` для конкретного пользователя.
`game:events` содержит непрерывный хвост `GameViewEventData`. Service определяет
viewer: автор приватного тестового хода получает `privateData`, остальные
игроки и зрители — только публичную часть. Один сырой event комнате не
рассылается.

`game:command` сначала дожидается database commit. После каждого сохранённого
изменения `GameService` публикует одно обновление. `createSocketServer` оформляет
одну подписку и запрашивает безопасный хвост отдельно для каждого socket
комнаты; command adapter не запускает вторую рассылку. Если отправитель ещё не
вошёл в комнату, он получает безопасные события непосредственно из результата
команды. Ошибка отдельного подписчика не отменяет уже сохранённую команду.

Exact duplicate не выполняется повторно и синхронизирует только отправителя.
Version conflict возвращает `game:error` с `currentVersion`; конфликтующий
`commandId` не раскрывает identity ранее сохранённой команды.

Стабильные коды `game:error` включают `invalid_message`, `game_not_found`,
`game_command_forbidden`, `game_position_occupied`, `game_version_conflict`,
`command_id_conflict`, `game_command_rejected` и `internal_error`.

## Runtime connections

`game:join` не является доменной командой `JoinGame` и не создаёт строку
`game_participants`. Он регистрирует socket ID у текущего пользователя только
в `ActiveGame`. Повторный join того же socket не увеличивает число соединений.
`game:leave` и физический disconnect удаляют runtime connection.

Зритель и игрок в незапущенной игре не меняют persisted историю при отключении.
Активный игрок считается отключённым только после закрытия последнего socket:
server сохраняет `PlayerDisconnected` с точным `reconnectDeadline`, применяет
его после commit и запускает timer. Новое подключение до срока сохраняет
`PlayerReconnected` и отменяет timer. Presence и deadline видны в персональном
snapshot и безопасных view events.

По истечении срока server повторно проверяет актуальное состояние в общей
игровой очереди. Если игрок всё ещё отключён с тем же deadline, одной
транзакцией сохраняются `PlayerDefeated` и `GameFinished`. После commit
Socket.IO adapter рассылает системные события каждому socket комнаты в его
безопасном представлении.

Если сохранение поражения временно завершилось ошибкой либо engine не создал
события при всё ещё актуальном deadline, service повторяет попытку через 1, 2,
4 секунды и далее с пределом 60 секунд между попытками. Перед каждой попыткой
условия проверяются заново. Reconnect, новый deadline, завершение игры или
закрытие service останавливают устаревшие retries.

## Завершение работы

В Fastify `preClose` server сначала закрывает Socket.IO и ждёт callback, а
затем дожидается уже начатых игровых операций, включая persisted disconnect
активных клиентов. Только после этого общий `onClose` закрывает game service и
database connection. Закрытый service очищает deadline timers и не планирует
новые retries.
