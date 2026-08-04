# Web-клиент

`apps/web` — браузерное React-приложение War Chest. Сейчас это рабочий
технический каркас: он запускается через Vite, строит маршруты, переключает
real/fake backend в development-сборке и умеет принять игровой snapshot и
последовательность событий. Полноценные экраны авторизации, лобби и игры ещё не
реализованы — вместо них отображаются страницы-заглушки.

Клиент всегда обращается к backend относительно своего origin. Обычные запросы
должны начинаться с `/api/`, Socket.IO использует `/api/socket.io`. В
development и preview эти пути проксирует Vite, а в production их вместе со SPA
обслуживает Fastify.

## Что уже работает

- React 19 и Vite 8;
- маршрутизация React Router в Declarative Mode;
- генерация URL через `nice-web-routes`;
- TanStack Query provider с общей конфигурацией запросов;
- Zustand-store активной игровой сессии;
- real Socket.IO connection и минимальная fake-реализация;
- development-панель с persisted-переключателем backend;
- SCSS и SCSS Modules;
- unit-, component-, fake E2E- и real E2E-тесты.

## Что пока не работает

- HTTP API client и загрузка данных через TanStack Query;
- реальные формы и пользовательские сценарии на страницах;
- авторизация из web-интерфейса;
- fake HTTP backend, SharedWorker и IndexedDB gateway;
- отправка игровых команд;
- reconnect и запрос недостающих событий;
- просмотр и воспроизведение истории игры.

## Документы раздела

- [Runtime-поведение](./runtime.md) — провайдеры, маршруты, backend switch и
  игровое состояние.
- [Сборка и способы запуска](./build-and-hosting.md) — Vite development,
  preview и размещение SPA на Fastify.
- [Тестирование](./testing.md) — именование тестов и Docker-контуры Playwright.

Целевая архитектура и оставшиеся этапы описаны в
[плане разработки клиента](../development-plan/client.md).
