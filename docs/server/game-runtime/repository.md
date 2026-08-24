# Repository и хранение игры

`apps/server/src/games/GameRepository.ts` — единственная прикладная граница над
таблицами `games`, `game_participants`, `processed_commands` и `game_events`.
Repository не интерпретирует доменные события: application service заранее
вычисляет изменения проекций, а repository проверяет версии и сохраняет
полученные данные атомарно.

## Идентичность команды

Клиент создаёт UUID `commandId`; server использует его как idempotency key.
В `processed_commands` также сохраняются `gameId`, `userId`, `commandType` и
`requestHash` — lowercase SHA-256 канонического JSON идентичности запроса.
Ключи объектов сортируются рекурсивно, поэтому порядок полей JSON не меняет
hash.

Для `CreateGame` hash строится по операции и `userId`, потому что новый
`gameId` ещё не известен клиенту; exact duplicate сравнивает сохранённые
`userId`, тип `CreateGame` и `requestHash`. Для остальных команд hash включает
`gameId`, `userId`, `expectedVersion` и payload команды, а exact duplicate
дополнительно сравнивает `gameId`, пользователя и тип. Любое несовпадение при
повторном UUID возвращает `commandIdConflict` и не раскрывает метаданные
исходной команды.

Repository повторяет эту проверку внутри транзакции. Если два запроса с одним
UUID одновременно дошли до вставки, PostgreSQL SQLSTATE `23505` для primary key
`processed_commands` переводится в тот же duplicate/conflict результат.

## Транзакции

Создание игры одной транзакцией добавляет:

1. строку `games` с `currentVersion = 1`;
2. строку `processed_commands` для `CreateGame`;
3. первое событие `GameCreated` с `sequence = 1`.

Обычная команда блокирует строку игры через `FOR UPDATE`, затем повторно
проверяет существующий `commandId` и `expectedVersion`. После проверок одна
транзакция сохраняет `processed_commands`, все события команды, изменения
`game_participants` и проекции статуса игры. `currentVersion` устанавливается
в `sequence` последнего события. Пустой набор событий repository не принимает.

Presence и deadline-события сохраняются через отдельную операцию
`saveSystemEvents`. Она также блокирует игру, проверяет версию и обновляет
проекции, но не создаёт фиктивную клиентскую команду: у таких событий
`commandId = null`.

Любая ошибка откатывает события, команду и проекции вместе. Состояние в памяти
до завершения транзакции не меняется.

## Чтение и проверка истории

`loadEvents(gameId, afterSequence)` возвращает события по `sequence ASC`.
Каждая database-строка проходит `parseGameEventData` из game engine до выхода
из repository. Некорректные type, version или payload приводят к
`CorruptedGameHistoryError`; исходный payload не включается в сообщение ошибки.

При replay `GameService` дополнительно проверяет, что история начинается с
`GameCreated` с sequence 1, не содержит пропусков и заканчивается на
`games.currentVersion`. Повреждённая история не применяется частично.

PostgreSQL integration-тесты repository требуют отдельную базу, имя которой
заканчивается на `_test`, и `WAR_CHEST_TEST_DATABASE_URL`. Если переменная не
задана, обычный unit-набор безопасно пропускает эти сценарии.
