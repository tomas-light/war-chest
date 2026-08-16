# Этап 8. Reconnect, deadline и recovery

Цель этапа — сделать временное отключение частью сохранённой истории. После
перезапуска server должен восстановить state и таймеры из PostgreSQL, а
повторная обработка одного deadline не должна создавать второе поражение.

## Сначала расширить game engine

Текущий engine ещё не содержит reconnect-событий. До server-кода добавить
команды/события и безопасные view events:

- `PlayerDisconnected { playerId, reconnectDeadline }`;
- `PlayerReconnected { playerId }`;
- `PlayerDefeated { playerId, reason: 'disconnectTimeout' }`;
- при выполнении условия завершения — существующий `GameFinished`.

State должен хранить presence/deadline, достаточные для replay. Все timestamp
сериализуются в ISO 8601 UTC. Engine решает, допустимо ли отключение,
возвращение или поражение; server только планирует время выполнения.

## Учёт соединений

`ActiveGame` хранит набор socket ID на каждого игрока. Игрок считается
отключённым только когда закрыто его последнее соединение с игрой. Spectator
connections не создают доменные события.

При последнем disconnect server через общую последовательную очередь:

1. Вычисляет deadline из `DISCONNECTED_PLAYER_TIMEOUT_MINUTES`.
2. Формирует и атомарно сохраняет `PlayerDisconnected`.
3. После commit применяет событие и запускает timer.

При reconnect до deadline аналогично сохраняется `PlayerReconnected`, а timer
отменяется после commit.

## Истечение deadline

Timer не является источником истины. При срабатывании server заново загружает
актуальную игру в её очереди и проверяет, что тот же player всё ещё отключён с
тем же deadline. Только затем сохраняются `PlayerDefeated` и, при необходимости,
`GameFinished`.

System events могут иметь `game_events.command_id = NULL`; для их
идемпотентности используется блокировка строки игры и проверка текущего state.
Не создавать фиктивного пользователя в `processed_commands`.

## Восстановление после restart

При загрузке active game service replay-ит всю историю. Для каждого
неистёкшего deadline запускается timer на оставшееся время. Истёкший deadline
ставится в ту же игровую очередь немедленно. Если другой process уже сохранил
reconnect/defeat, повторная проверка state превращает задачу в no-op.

После восстановления новый client получает обычный безопасный snapshot; ему не
нужно знать, был ли state в памяти или собран replay.

## Проверки этапа

- закрытие одного из нескольких socket игрока не создаёт disconnect;
- последнее соединение создаёт одно `PlayerDisconnected` с точным deadline;
- reconnect до срока создаёт одно `PlayerReconnected` и отменяет timer;
- старый timer после reconnect ничего не сохраняет;
- истечение срока создаёт одно поражение;
- одновременные timer workers не создают двойное поражение;
- restart восстанавливает state и будущие timers из истории;
- уже истёкший deadline обрабатывается сразу после recovery;
- завершение по disconnect сохраняет defeat и GameFinished атомарно;
- spectator disconnect не меняет игровую историю;
- клиент после reconnect получает непрерывный sequence или snapshot.
