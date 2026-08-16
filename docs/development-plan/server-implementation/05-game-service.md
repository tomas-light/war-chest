# Этап 5. Game service и ActiveGame

Цель этапа — связать чистый `game-engine` с репозиторием, не смешивая transport
и persistence. Service принимает доверенную identity, выполняет правила,
сохраняет результат и только после commit меняет состояние в памяти.

## Файлы и ответственность

Создать:

- `apps/server/src/games/ActiveGames.ts` — registry активных игр и очередь
  последовательной обработки на `gameId`;
- `apps/server/src/games/GameService.ts` — application-сценарии создания,
  загрузки, join/start/command, snapshot и истории.

`ActiveGame` хранит актуальный `GameState` и набор подключений, но не предыдущие
states. Его версия не дублируется отдельным числом: использовать
`state.lastEventSequence`.

## Загрузка игры

При обращении service сначала ищет `ActiveGame`. Если его нет, он загружает всю
историю через repository, вызывает `restoreGame` и проверяет два инварианта:

- история начинается с `GameCreated` и имеет непрерывные sequence;
- восстановленный `lastEventSequence` равен `games.currentVersion`.

Waiting и active игры добавляются в registry. Finished game для единичного
запроса можно восстановить без постоянного кэширования.

## Обработка команд

Все команды одной игры проходят одну очередь, включая HTTP join/start и
Socket.IO `game:command`:

1. Получить или восстановить `ActiveGame`.
2. Проверить identity, участие и допустимую роль.
3. Для новой команды проверить ожидаемую версию состояния.
4. Вызвать `decide` и получить события.
5. Передать события и проекции в `GameRepository.saveCommand`.
6. При `saved` последовательно вызвать `applyEvent` и заменить live state.
7. Вернуть результат, достаточный transport-адаптеру для snapshot/events.

Создание игры — отдельный сценарий: service перечитывает
`FeatureFlagsService`, вызывает `createGame`, затем атомарный repository method.
Флаги из клиента не принимаются.

## Duplicate и conflict

`duplicateCommand` не вызывает `decide` и не применяет события второй раз.
Service загружает актуальное состояние и возвращает вызывающему адаптеру:

- snapshot, если состояние клиента неизвестно или его sequence больше server;
- события после известного `afterSequence`, если непрерывный хвост доступен.

`versionConflict` также не меняет состояние. Transport получает текущий
`lastEventSequence` и может запросить sync. Repository остаётся последней
защитой от гонки, даже если in-memory проверка уже прошла.

## Безопасные представления

Service, а не route/socket, определяет `Viewer` и использует
`createViewFor`/`createViewEventFor`. Игрок получает private data только для
себя; зритель — только публичные поля. Не отдавать наружу `GameState` или сырые
`GameEventData`.

## Проверки этапа

- create читает runtime flags при каждом вызове и сохраняет их в GameCreated;
- existing game не перечитывает runtime flags;
- отсутствующий ActiveGame восстанавливается из полной истории;
- команды одной игры выполняются последовательно;
- разные игры не блокируют друг друга;
- событие применяется к state только после успешного repository result;
- duplicate не вызывает engine повторно и возвращает данные для recovery;
- conflict не меняет state;
- player и spectator получают разные безопасные views.
