# Fake database

`@war-chest/fake-database` — готовое browser-only хранилище для разработки
клиента без Node.js-сервера и PostgreSQL. Пакет сохраняет fake-состояние в
IndexedDB, повторяет нужные клиенту доменные сущности и даёт два уровня API:
простые типизированные таблицы и репозитории с проверками целостности.

## Что реализовано

- версия 1 IndexedDB-схемы с восемью object stores и миграцией;
- прослойка `Table` над низкоуровневым API пакета `idb`;
- атомарные транзакции для связанных записей и публичный transaction API;
- репозитории пользователей, сессий, игр и runtime feature flags;
- стабильные Google, Telegram и Yandex fixtures и идемпотентный seed;
- полный reset базы с восстановлением исходных fixtures;
- 21 тест на `fake-indexeddb`, включая откат транзакций и сохранение данных
  после повторного открытия базы.

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
Эти части относятся к следующему этапу клиентского fake backend. В целевой
архитектуре именно `SharedWorker` владеет одним экземпляром фасада, благодаря
чему вкладки одного origin последовательно изменяют общую IndexedDB.

Подробности:

- [Схема и табличный слой](./storage.md);
- [Репозитории, fixtures и проверки](./repositories.md);
- [План клиентского fake backend](../development-plan/client-development/README.md).
