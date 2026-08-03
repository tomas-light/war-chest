# Схема и табличный слой

IndexedDB остаётся инфраструктурной деталью пакета. Код репозиториев работает с
понятными таблицами, а прямые вызовы `IDBRequest`, object stores и ручное
ожидание транзакций не распространяются по проекту.

## Схема данных

Первая версия базы создаёт следующие stores:

| Store                 | Ключ                 | Значение                    | Индексы                         |
| --------------------- | -------------------- | --------------------------- | ------------------------------- |
| `users`               | `id`                 | `FakeUser`                  | —                               |
| `userIdentities`      | `id`                 | `FakeUserIdentity`          | —                               |
| `authSessions`        | `id`                 | `FakeAuthSession`           | —                               |
| `games`               | `id`                 | `FakeGame`                  | —                               |
| `gameParticipants`    | `[gameId, userId]`   | `FakeGameParticipant`       | —                               |
| `processedCommands`   | `id`                 | `FakeProcessedCommand`      | —                               |
| `gameEvents`          | `id`                 | `FakeGameEvent`             | `by-game-sequence`, уникальный  |
| `runtimeFeatureFlags` | `application`        | `FakeRuntimeFeatureFlags`   | —                               |

Значения `Date` хранятся как native structured-clone values, поэтому после
чтения остаются объектами `Date`. Физическая схема не копирует PostgreSQL один
в один: она сохраняет только данные, которые нужны fake-контракту клиента.

Единственный индекс строится по составному ключу `[gameId, sequence]`. Он нужен
для упорядоченного чтения отрезка истории и одновременно гарантирует
уникальность номера события внутри игры. При ожидаемых примерно 100 играх и до
1000 событий в каждой это полезный доступ к потенциально большой коллекции.
Пользователей, участников и игр в fixtures существенно меньше, поэтому там
репозитории выполняют `getAll()` и фильтруют данные в памяти без лишних индексов.

## Табличный API

`SchemaTable` выводит ключ, значение и доступные индексы непосредственно из
`DBSchema`. Для каждой таблицы доступны одинаковые операции:

```ts
type Table<Key, Value> = {
  getAll(): Promise<Value[]>;
  get(key: Key): Promise<Value | undefined>;
  insert(key: Key, value: Value): Promise<Key>;
  update(key: Key, value: Value): Promise<Key | undefined>;
  delete(key: Key): Promise<void>;
  deleteAll(): Promise<void>;
};
```

`insert()` использует семантику IndexedDB `add` и завершается ошибкой при
повторном ключе. `update()` не превращается в неявный upsert: для отсутствующей
записи он возвращает `undefined`. Для stores с inline key табличный слой также
проверяет, что переданный ключ совпадает с ключом внутри значения.

Индекс открывается типизированным методом таблицы:

```ts
const events = await fakeDatabase.gameEvent
  .index('by-game-sequence')
  .getAll(IDBKeyRange.bound([gameId, 1], [gameId, 1000]));
```

## Транзакции и целостность

Одиночные `insert()` и `update()` сами завершают write-транзакцию до возврата
результата. Для нескольких связанных записей фасад предоставляет атомарный
callback:

```ts
await fakeDatabase.transaction(async (tables) => {
  await tables.game.insert(game.id, game);
  await tables.gameParticipant.insert(
    [participant.gameId, participant.userId],
    participant,
  );
});
```

Callback получает те же таблицы, но привязанные к одной read-write транзакции.
Если операция или constraint завершается ошибкой, вся транзакция откатывается.
Репозитории используют тот же механизм для сохранения пользователя вместе с
identity, сессии вместе с проверкой пользователя, игровых изменений и reset.
