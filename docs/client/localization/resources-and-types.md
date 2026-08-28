# Ресурсы и типизация

## Размещение ресурсов

Каждый локализованный FSD-слайс хранит парные файлы `i18n/en.json` и
`i18n/ru.json`. Namespace равен пути слайса относительно `apps/web/src`:

```text
src/entities/user/i18n/ru.json → entities/user
src/pages/lobby/i18n/en.json   → pages/lobby
```

Внутри namespace ключи группируются по компоненту:

```json
{
  "UserAvatar": {
    "label": "User's avatar {{userName}}"
  }
}
```

Компонент указывает и namespace, и собственный префикс:

```tsx
const { t } = useTranslation('entities/user', {
  keyPrefix: 'UserAvatar',
});

t('label', { userName: user.displayName });
```

Локальное ESLint-правило запрещает `useTranslation()` без статически
заданного namespace.

## Генератор типов

Команда `locale:generate` сканирует все каталоги `src/**/i18n`, проверяет
ресурсы и создаёт
`src/shared/i18n/__generated__/WarChestResources.d.ts`. Значения листьев в типе
содержат только сигнатуру interpolation-параметров, например
`"{{userName}}"`, без текста перевода. Для ключей без параметров генерируется
пустой строковый literal. Благодаря этому TypeScript проверяет namespace,
`keyPrefix`, ключи и обязательные параметры вызова `t()`, но переводы не
дублируются в generated-файле. Дополнительный generated-интерфейс хранит для
каждого логического ключа только обязательные interpolation-параметры и
`count` для plural-ключей. Обёртка `shared/i18n/useTranslation` использует этот
контракт, поэтому вызов `t()` без обязательного параметра не компилируется.
После записи генератор форматирует declaration через Prettier и запускает для
него ESLint с автоисправлениями; ошибка линтера завершает генерацию с ошибкой.

`types:build` и production `build` запускают генерацию один раз. `dev` сначала
генерирует типы, затем параллельно запускает Vite и `locale:watch`; watcher
пересобирает declaration при изменении `en.json` или `ru.json`.

Generated-файл не редактируется вручную.

## Проверки ресурсов

Генератор отклоняет:

- непарные `en.json` и `ru.json`;
- некорректный JSON, пустые объекты и значения, отличные от строк;
- ключ, отсутствующий в одном из языков;
- различающийся набор interpolation-параметров.

Plural-суффиксы `_zero`, `_one`, `_two`, `_few`, `_many` и `_other` полностью
игнорируются при сравнении языков. Например, `people_many` в английском и
`people_other` в русском сравниваются как один логический ключ `people`; число
plural-форм в языках может различаться.
