# Server

`apps/server` — Fastify-приложение War Chest. Оно подключает PostgreSQL и пакет
авторизации, перечитывает runtime feature flags, обслуживает реализованные HTTP
endpoints, проверяет Socket.IO сессию и при необходимости раздаёт production
bundle клиента.

Сейчас server предоставляет инфраструктурный и пользовательский контур, но ещё
не обрабатывает игру. Игровые команды по Socket.IO валидируются, однако не
передаются в `game-engine`, не сохраняются и не создают ответных событий.

## Что уже работает

- загрузка и Zod-валидация server-конфигурации;
- обязательная проверка PostgreSQL перед началом прослушивания порта;
- health endpoint;
- вход через Google, Telegram и Yandex ID;
- получение текущей сессии и logout;
- защищённые endpoints профиля, аватара и истории завершённых игр;
- runtime-reader и публичный endpoint boolean feature flags;
- Socket.IO authentication, runtime-валидация сообщений и комнаты игр;
- graceful close Socket.IO и database connection;
- опциональная раздача SPA с корректным deep-link fallback.

## Что пока не работает

- создание, загрузка и запуск игры;
- выполнение и сохранение игровых команд;
- рассылка snapshot/events/presence;
- reconnect recovery и восстановление активной игры.

## Документы раздела

- [HTTP API](./http-api.md) — фактически зарегистрированные маршруты и ответы.
- [Socket.IO](./socket-io.md) — handshake, сообщения и текущие ограничения.
- [Запуск и SPA hosting](./hosting.md) — конфигурация, lifecycle и production
  hosting.

Целевое серверное поведение находится в
[development plan](../development-plan/server.md).
