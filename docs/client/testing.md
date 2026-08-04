# Тестирование клиента

Тестовые контуры разделены по уровню ответственности. Unit-тесты быстро
проверяют функции и store, component-тесты — React-компоненты в браузере, E2E —
запуск приложения целиком.

## Именование и расположение

- `*.test.ts(x)` — unit-тест рядом с исходным файлом;
- `*.ctest.tsx` — component-тест рядом с компонентом;
- `*.spec.ts` — E2E-сценарий в `apps/web/tests/e2e`.

Корневой Vitest использует `test.projects` и включает web-конфигурацию вместе с
остальными workspace-проектами.

## Component tests

Компоненты монтируются через небольшую React gallery на порту 5174. Story-файлы
называются `*.story.tsx`, а тест открывает нужный export через query parameter.
Используется стабильный `@playwright/test`, без experimental CT package.

Запуск из корня:

```shell
yarn test:components
```

## E2E

Fake E2E запускает только Vite и выбирает fake backend через `localStorage`:

```shell
yarn test:e2e
```

Real E2E поднимает PostgreSQL, Vite и Fastify и проверяет проксирование API с
web-origin:

```shell
yarn test:e2e:real
```

Все browser-тесты выполняются в образе
`mcr.microsoft.com/playwright:v1.62.1-noble`. Исходники монтируются read-only,
зависимости устанавливаются внутри временной Linux filesystem, поэтому
локальный `node_modules` не изменяется. Это также стабилизирует окружение для
будущих screenshot-тестов.
