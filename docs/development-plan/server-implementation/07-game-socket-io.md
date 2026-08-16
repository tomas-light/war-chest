# Этап 7. Игровой Socket.IO

Цель этапа — заменить transport scaffold реальной обработкой активной игры и
персонализированной рассылкой. Существующие session handshake, путь
`/api/socket.io` и Zod-схемы нужно сохранить.

## Подключение к service

Вынести игровую регистрацию в
`apps/server/src/games/registerGameSocket.ts`. `createSocketServer.ts` остаётся
владельцем Socket.IO instance и authentication, а игровой adapter получает
`GameService` явной зависимостью.

Семантика входящих сообщений:

- `game:join` — подключить socket к комнате и отправить безопасный snapshot;
  это не доменная команда `JoinGame` и не создаёт участие;
- `game:leave` — покинуть комнату и убрать runtime connection;
- `game:sync` — отправить события после `afterSequence` либо полный snapshot;
- `game:command` — выполнить уже типизированную команду с client `commandId` и
  `expectedVersion`.

## Рассылка

Нельзя рассылать один сырой event всей комнате. После commit service строит
view events для каждого viewer и отправляет:

- игроку — его разрешённые private data;
- другому игроку — публичную замену скрытого события;
- зрителю — только публичное представление.

Если конкретное внутреннее событие полностью скрыто, отправляется
`ViewSequenceAdvanced`, чтобы `lastEventSequence` у клиента не расходился с
server. Порядок событий в одном сообщении сохраняет database sequence.

## Идемпотентность и recovery

При duplicate `commandId` socket не получает второе применение. Adapter
отправляет текущий snapshot или непрерывный хвост после известного sequence.
При version conflict отправляется `game:error` с текущей server version, после
чего клиент выполняет `game:sync`.

Malformed message получает стабильный `game:error`; ошибка одного socket не
разрывает namespace и не влияет на другие комнаты.

## Проверки этапа

- unauthenticated handshake отклоняется;
- malformed UUID/body не достигает service;
- join комнаты отправляет персональный snapshot;
- spectator не создаётся в `game_participants`;
- команда сохраняется до первой рассылки;
- два viewer получают разные представления private event;
- hidden event продвигает sequence через `ViewSequenceAdvanced`;
- duplicate не создаёт событие второй раз и синхронизирует отправителя;
- conflict сообщает текущую версию;
- команды разных игр не смешиваются между комнатами;
- disconnect/close корректно освобождает runtime connection.
