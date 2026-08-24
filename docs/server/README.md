# Server

`apps/server` — Fastify-приложение War Chest. Оно подключает PostgreSQL и пакет
авторизации, перечитывает runtime feature flags, обслуживает реализованные HTTP
endpoints, проверяет Socket.IO сессию и при необходимости раздаёт production
bundle клиента.

Сейчас server предоставляет инфраструктурный и пользовательский контур,
PostgreSQL-границу хранения игры, application service, игровой HTTP API,
Socket.IO transport с персонализированной рассылкой и восстановление активных
игр после перезапуска.

## Что уже работает

- загрузка и Zod-валидация server-конфигурации;
- обязательная проверка PostgreSQL перед началом прослушивания порта;
- health endpoint;
- вход через Google, Telegram и Yandex ID;
- получение текущей сессии и logout;
- защищённые endpoints профиля, аватара и истории завершённых игр;
- runtime-reader и публичный endpoint boolean feature flags;
- атомарный `GameRepository` для команд, событий и SQL-проекций;
- защита команд через `commandId`, `requestHash` и `expectedVersion`;
- упорядоченная загрузка persisted events с runtime-валидацией;
- `ActiveGames` с независимой последовательной очередью на каждую игру;
- `GameService` для создания, replay и выполнения команд через `game-engine`;
- канонический SHA-256 request hash и безопасные duplicate/conflict результаты;
- применение событий к live state только после успешного database commit;
- персональные snapshots и event tails для игрока или зрителя;
- Socket.IO authentication, runtime-валидация и подключение комнат к service;
- персонализированная рассылка событий только после database commit;
- socket recovery для duplicate и version conflict;
- persisted presence, reconnect deadlines и поражение по таймауту;
- учёт нескольких socket одного игрока без преждевременного disconnect;
- восстановление активных игр и deadline timers из полной истории;
- безопасная рассылка системных presence events после database commit;
- graceful close Socket.IO и database connection;
- опциональная раздача SPA с корректным deep-link fallback.

## Что пока не работает

- полные правила War Chest вместо технического игрового сценария.

## Документы раздела

- [HTTP API](./http-api.md) — фактически зарегистрированные маршруты и ответы.
- [Socket.IO](./socket-io.md) — handshake, сообщения и текущие ограничения.
- [Игровой runtime](./game-runtime/README.md) — repository, application service,
  идемпотентность, live state, presence и recovery.
- [Запуск и SPA hosting](./hosting.md) — конфигурация, lifecycle и production
  hosting.

Оставшиеся серверные работы находятся в
[development plan](../development-plan/server.md).
