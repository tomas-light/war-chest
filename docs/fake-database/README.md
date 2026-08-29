# Fake database

`@war-chest/fake-database` — готовое browser-only хранилище для разработки
клиента без Node.js-сервера и PostgreSQL. Пакет сохраняет fake-состояние в
IndexedDB, повторяет нужные клиенту доменные сущности и даёт два уровня API:
простые типизированные таблицы и репозитории с проверками целостности.

## Что реализовано

- версия 4 IndexedDB-схемы с восемью object stores и миграциями;
- прослойка `Table` над низкоуровневым API пакета `idb`;
- атомарные транзакции для связанных записей и публичный transaction API;
- репозитории пользователей, сессий, игр и runtime feature flags;
- стабильные Google, Telegram и Yandex fixtures и идемпотентный seed;
- полный reset базы с восстановлением исходных fixtures;
- тесты на `fake-indexeddb`, включая откат транзакций и сохранение данных после
  повторного открытия базы.

Миграции на версии 2, 3 и 4 удаляют только игровые записи и обработанные игровые
команды: сначала для обязательных `team` и `seat`, затем для обязательного
`GameCreated.creatorId` и, наконец, для правила одного активного участия и
обмена позициями. Пользователи, identities, auth sessions и feature flags
сохраняются.

Доменные типы пользователей, игр, участников, команд и событий переиспользуются
из `@war-chest/database` через type-only imports. Поэтому браузерный runtime не
загружает Drizzle или PostgreSQL-код, а две схемы не дублируют определения
одинаковых сущностей. Единственное намеренное отличие — `FakeAuthSession` не
содержит `tokenHash`: fake-режиму не нужно хранить хеш серверного cookie.

## Точка входа

Обычный потребитель создаёт один фасад. При первом открытии он применяет
миграции и добавляет отсутствующие начальные данные:

```ts
import { createFakeDatabase } from '@war-chest/fake-database';

const fakeDatabase = await createFakeDatabase();

await fakeDatabase.game.insert(game.id, game);
const storedGames = await fakeDatabase.game.getAll();
const activeSession = await fakeDatabase.sessions.findActive(sessionId);

fakeDatabase.close();
```

Свойства в единственном числе (`game`, `gameEvent`, `user`) — прямые таблицы.
Свойства во множественном числе (`games`, `sessions`, `users`) и
`featureFlags` — доменные репозитории. Фасад также предоставляет `reset()`,
`transaction()` и исходное соединение `connection` для инфраструктурного кода.

Для изолированных тестов можно передать уникальное имя базы в
`createFakeDatabase({ name })`, а затем удалить её через
`deleteFakeDatabase({ name })`.

## Граница пакета

Пакет не содержит React, HTTP-адаптер, игровое соединение или `SharedWorker`.
Fake backend в `apps/web` открывает фасад только внутри `SharedWorker`. Auth,
feature flags и game adapters вкладки обращаются к worker через RPC, поэтому
вкладки одного origin последовательно изменяют общую IndexedDB. API самого
пакета при переносе владельца не изменился.

Подробности:

- [Схема и табличный слой](./storage.md);
- [Репозитории, fixtures и проверки](./repositories.md);
- [План клиентского fake backend](../development-plan/client-development/README.md).
