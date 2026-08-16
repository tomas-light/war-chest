# Этап 4. Игровой репозиторий

Цель этапа — создать единственную server-границу над игровыми таблицами. Она
должна атомарно сохранять принятые команды и события, защищать игру от
повторного выполнения и предоставлять упорядоченную историю для replay.
Game rules и изменение состояния в памяти в репозиторий не входят.

## Входные контракты

Работать нужно в новом `apps/server/src/games/GameRepository.ts`. Главная
экспортируемая сущность — `GameRepository`; фабрика
`createGameRepository(database)` находится в том же файле. Не расширять barrel
exports без реального потребителя.

Минимальный публичный API должен покрывать:

```ts
interface GameRepository {
  createGame(input: CreateStoredGameInput): Promise<CreateStoredGameResult>;
  findGame(gameId: string): Promise<StoredGame | null>;
  findParticipant(
    gameId: string,
    userId: string
  ): Promise<StoredParticipant | null>;
  loadEvents(
    gameId: string,
    afterSequence?: number
  ): Promise<readonly GameEventData[]>;
  saveCommand(input: SaveGameCommandInput): Promise<SaveGameCommandResult>;
}

type CreateStoredGameResult =
  | { gameId: string; status: 'created' }
  | { gameId: string; status: 'duplicateCommand' };

type SaveGameCommandResult =
  | { currentVersion: number; status: 'saved' }
  | { currentVersion: number; status: 'duplicateCommand' }
  | { currentVersion: number; status: 'versionConflict' };
```

Имена вспомогательных input/result-типов можно уточнить во время реализации,
но три результата `saveCommand` и их смысл менять нельзя. Репозиторий принимает
уже сформированные `GameEventData`; он не вызывает `decide`, `createGame` или
`applyEvent`.

## Транзакция создания

`createGame` получает клиентский `commandId`, `creatorUserId` и сформированный
`GameCreated`. В одной транзакции он:

1. Проверяет существование `processed_commands.id = commandId`.
2. При duplicate возвращает связанную игру без новых записей.
3. Создаёт `games` со статусом `waiting` и `currentVersion = 1`.
4. Создаёт `processed_commands` с типом `CreateGame`.
5. Создаёт `game_events` с `sequence = 1` и ссылкой на `commandId`.
6. Возвращает созданный `gameId` только после commit.

Конкурентная вставка одинакового `commandId` может пройти между чтением и
insert. Unique violation по `processed_commands.id` нужно распознать как
duplicate, а не как HTTP 500; после rollback следует прочитать уже сохранённую
команду и вернуть её `gameId`.

## Транзакция обычной команды

`saveCommand` выполняет операции в таком порядке:

1. Начинает транзакцию и блокирует строку игры `FOR UPDATE`.
2. Проверяет `processed_commands.id`. Duplicate имеет приоритет даже при
   устаревшем `expectedVersion`.
3. Сравнивает `expectedVersion` с заблокированным `games.currentVersion`.
4. Вставляет `processed_commands`.
5. Вставляет все события с последовательными `sequence` и одним `commandId`.
6. Обновляет проекции `games` и `game_participants`, необходимые для запросов.
7. Устанавливает `games.currentVersion` в `sequence` последнего события.
8. Делает commit и возвращает `saved`.

При duplicate и version conflict транзакция не создаёт ни команды, ни события.
Если любая запись события или проекции падает, откатывается вся команда.

## Чтение и replay

`loadEvents` всегда сортирует по `sequence ASC`. `afterSequence` означает
строгое `sequence > afterSequence`. Преобразование database JSON в
`GameEventData` должно отбрасывать неизвестные type/version/payload как
повреждённую историю, а не молча возвращать частичный state.

`findParticipant` используется для авторизации игрока. Отсутствующая запись не
создаёт spectator в базе: роль зрителя остаётся runtime-решением service.

## Проверки этапа

- создание сохраняет игру, команду и `GameCreated` атомарно;
- повторный create с тем же `commandId` возвращает тот же `gameId`;
- сохранение нескольких событий использует одну команду и непрерывные sequence;
- duplicate проверяется раньше version conflict;
- неверный `expectedVersion` не создаёт записей;
- rollback не оставляет частично сохранённую команду;
- параллельные команды одной версии дают один `saved` и один conflict;
- `currentVersion` после каждой успешной транзакции равен последнему sequence;
- история загружается в порядке `sequence ASC`.

Для конкурентности и rollback нужны integration-тесты с PostgreSQL; один mock
Drizzle не подтверждает транзакционные гарантии.
