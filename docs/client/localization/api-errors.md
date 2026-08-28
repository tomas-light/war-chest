# Локализация ошибок API

Server возвращает техническое сообщение для диагностики и стабильный `code`
из `ApiErrorCode`. Клиент не показывает `message` пользователю: HTTP, Socket.IO
и fake adapters преобразуют сбой в `ApiClientError`, а `useApiErrorMessage()`
выбирает текст из `shared/api/i18n` по коду.

Неизвестный код сохраняется в `serverCode` для диагностики и отображается через
безопасный ключ `unknown`. Сетевой сбой и некорректный ответ имеют клиентские
коды `network_error` и `invalid_response`.

При добавлении нового server-кода нужно:

1. добавить его в `API_ERROR_CODES` пакета `@war-chest/api-contracts`;
2. вернуть этот код из real и эквивалентного fake adapter;
3. добавить ключ в `shared/api/i18n/en.json` и `ru.json`;
4. обновить тест observable-контракта и выполнить `locale:generate`.

Google endpoint возвращает обычный JSON error envelope. Telegram и Yandex
используют browser redirect, поэтому при ошибке server направляет пользователя
на `/login?authError=<code>`. `LoginPage` читает код и переводит его тем же
механизмом; server message в URL не передаётся.
