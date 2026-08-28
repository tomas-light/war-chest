# Требования к коду и стилю

Эти инструкции фиксируют общие правила написания и изменения кода в репозитории. Соблюдай их при реализации новых возможностей, рефакторинге, cleanup и оптимизации.

## Визуальный стиль UI

- Перед изменением интерфейса `apps/web` прочитай
  [визуальный контракт War Chest](./docs/ui/README.md) и сверяй с ним новые
  экраны, компоненты и состояния.
- Сохраняй смесь cyberpunk и steampunk: тёмный металл служит основой, латунь
  формирует конструкцию и главные действия, cyan-неон обозначает энергию,
  focus, активность и загрузку. Не своди стиль ни к чисто коричневому
  стимпанку, ни к сплошному неоновому cyberpunk.
- Используй глобальные `--wc-*` токены и существующие shared-компоненты. Новый
  цвет или визуальный вариант добавляй только для роли, которой ещё нет в
  системе.
- В UI используй объёмный `war-chest-logo-512.png` через `WarChestLogo`, а не
  `logo-flat`, если задача явно не требует другого варианта.
- Проверяй desktop и mobile, промежуточные loading/error-состояния, отсутствие
  layout shift, клавиатурный focus и `prefers-reduced-motion`.

## Стиль функций

- При объявлении новых именованных функций в JavaScript и TypeScript отдавай предпочтение `function declaration`, а не arrow function.
- Arrow function допустимы для безымянных callback-функций.

```ts
// ❌ Не надо так: именованное поведение спрятано в arrow function
function createController() {
  const handle = () => {
    /* ... */
  };

  return { handle };
}
```

```ts
// ✅ Надо так: именованное поведение объявлено через function declaration
function createController() {
  return { handle };

  function handle() {
    /* ... */
  }
}
```

```ts
// ⚠️ Так можно: arrow function используется как безымянный callback
function hasMatchingItem() {
  return [1, 2, 3].some((item) => item > 1);
}

// ✅ Ещё один хороший пример: основной сценарий расположен выше деталей реализации
function createUserService() {
  return { findUser, saveUser };

  function findUser(userId: string) {
    /* ... */
  }

  function saveUser(user: User) {
    /* ... */
  }
}
```

- При объявлении нескольких функций в одном файле располагай вызывающий код выше реализации вызываемой функции. Код должен по возможности читаться сверху вниз: сначала использование функции, затем её реализация.

```ts
// ❌ Плохо: bar объявлена раньше места, где она вызывается
function bar() {}

function foo() {
  bar();
}
```

```ts
// ✅ Хорошо: сначала вызов bar, затем её реализация
function foo() {
  bar();
}

function bar() {}

// ✅ Хорошо: основной сценарий читается раньше вспомогательных деталей
function submitOrder(order: Order) {
  validateOrder(order);
  persistOrder(order);
}

function validateOrder(order: Order) {
  /* ... */
}

function persistOrder(order: Order) {
  /* ... */
}
```

- Если функция принимает больше трёх параметров, объединяй их в один
  аргумент-объект. В TypeScript описывай его именованным типом или интерфейсом,
  чтобы на месте вызова были видны имена передаваемых значений и их назначение.

```ts
// ❌ Плохо: назначение соседних аргументов приходится восстанавливать по сигнатуре
function sendMessage(
  userId: string,
  text: string,
  channel: string,
  urgent: boolean
) {}

// ✅ Хорошо: функция принимает один понятный аргумент-объект
interface SendMessageInput {
  channel: string;
  text: string;
  urgent: boolean;
  userId: string;
}

function sendMessage(input: SendMessageInput) {
  /* ... */
}

sendMessage({
  channel: 'game',
  text: 'Your turn',
  urgent: true,
  userId: 'user-one',
});
```

## Пропсы компонентов

- Если в файле объявлен один компонент, называй тип или интерфейс его пропсов
  просто `Props`, а не добавляй к имени название компонента, например
  `ButtonProps`.
- Не деструктурируй пропсы в параметрах функции компонента. Принимай их одним
  аргументом `props`, а затем извлекай нужные значения через отдельный
  `const` внутри тела функции.

```tsx
// ❌ Плохо: имя компонента дублируется в имени пропсов,
// а сами пропсы деструктурируются в параметрах функции
interface ButtonProps {
  disabled: boolean;
  label: string;
}

export function Button({ disabled, label }: ButtonProps) {
  return <button disabled={disabled}>{label}</button>;
}
```

```tsx
// ✅ Хорошо: в файле с одним компонентом достаточно общего имени Props,
// а деструктуризация выполняется внутри тела функции
interface Props {
  disabled: boolean;
  label: string;
}

export function Button(props: Props) {
  const { disabled, label } = props;

  return <button disabled={disabled}>{label}</button>;
}
```

## Работа с массивами

- При извлечении элементов массива по известным позициям отдавай предпочтение
  деструктуризации вместо обращений по фиксированным индексам.

```ts
// ❌ Не надо так: позиции извлекаются отдельными обращениями по индексам
const firstPlayer = state.players[0];
const secondPlayer = state.players[1];

// ✅ Лучше так: ожидаемая структура массива видна сразу
const [firstPlayer, secondPlayer] = state.players;
```

## Именование

- Не сокращай названия переменных, функций, типов и других сущностей.
- Допускаются только общеизвестные аббревиатуры и короткие технические
  названия, например `dto`, `config`, `env`.
- Названия должны отражать смысл сущности и не быть обезличенными.
- Статические значения на уровне файла называй через `UPPER_SNAKE_CASE`. Это
  относится к числам, строкам, регулярным выражениям, неизменяемым наборам и
  другим значениям, которые используются как константы.
- Именованные определения и доменные объекты, для которых в экосистеме принят
  `camelCase`, не переименовывай в `UPPER_SNAKE_CASE`. Например, сохраняй
  `camelCase` для Zod-схем, Drizzle-таблиц и Drizzle relations.

```ts
const delayMs = 500; // ❌ Неправильный стиль именования
const DELAY_MS = 500; // ✅ Название заглавными буквами через подчёркивание
const CONTENT_LENGTH_PATTERN = /^\d+$/; // ✅ Статическое регулярное выражение

const userSchema = z.object({}); // ✅ Zod-схема сохраняет camelCase
export const users = pgTable('users', {}); // ✅ Drizzle-таблица сохраняет camelCase

async function some() {
  const a = 1; // ❌ Обезличенное название
  const count = 1; // ✅ Название отражает смысл

  const usr = await loadUser(); // ❌ Неочевидное сокращение
  const user = await loadUser(); // ✅ Полное и понятное название

  function calcAmt() {} // ❌ Сокращения затрудняют чтение
  function calculateTotalAmount() {} // ✅ Смысл функции понятен из названия

  const orderDto = createOrderDto(); // ✅ DTO — общеизвестная аббревиатура

  try {
    // ...
  } catch (e) {} // ❌ Обезличенное название ошибки

  try {
    // ...
  } catch (error) {} // ✅ Понятное название ошибки
}
```

## Типизация TypeScript

- Не используй `any` ни явно, ни через утверждение типа или generic-аргумент:
  запрещены `any`, `as any`, `<any>` и аналогичные конструкции. Для данных с
  неизвестной структурой используй `unknown`, затем выполняй narrowing или
  runtime-валидацию.
- Не объявляй переменную через `let` без начального значения и без явной
  аннотации типа. Такая переменная получает evolving `any`, даже если
  TypeScript позднее уточняет её тип по присваиваниям.
- Если значение присваивается внутри `try`, условной ветки или callback и его
  нельзя сразу инициализировать, укажи явный доменный тип при объявлении.
- После обнаружения `any` или нетипизированного `let` проверь аналогичные места
  во всём затронутом package или application, а не исправляй только найденную
  строку.

```ts
// ❌ Плохо: featureFlags начинает жизнь как evolving any
let featureFlags;

// ✅ Хорошо: ожидаемый доменный контракт известен до присваивания
let featureFlags: FeatureFlags;

try {
  featureFlags = await featureFlagsService.read();
} catch (error: unknown) {
  // error необходимо сузить перед использованием
}
```

## Именование файлов

- Сначала определи, есть ли в файле явно главная экспортируемая сущность. Если
  она есть, называй файл точно так же, как эту сущность, включая регистр букв.
  Сущности в `PascalCase` должны находиться в файлах с именем в `PascalCase`, а
  сущности в `camelCase` — в файлах с именем в `camelCase`.
- Наличие вспомогательных типов, констант или фабрики не превращает файл в
  смысловую группировку, если главная сущность остаётся очевидной. Например,
  интерфейс `UserRepository` остаётся главной сущностью файла даже при наличии
  функции `createUserRepository` и связанных типов.
- Используй имя смыслового объединения нескольких сущностей только тогда, когда
  среди экспортов действительно нельзя выделить одну главную сущность.
- Используй в названиях файлов только стили `camelCase` и `PascalCase`. Не
  используй `dashed-case`.

```tsx
// app-provider.ts ❌ dashed-case и несовпадение с именем компонента
export function AppProviders() {}

// AppProviders.tsx ✅ PascalCase по имени компонента
export function AppProviders() {}
```

```ts
// routes.ts ❌ имя файла не совпадает с главной экспортируемой сущностью
export const appRoutes = [];

// appRoutes.ts ✅ имя файла совпадает с главной экспортируемой сущностью
export const appRoutes = [];
```

```ts
// lifecycleCommandData.ts ❌ регистр имени файла не совпадает с главной сущностью
export type CreateGameCommandData = { type: 'CreateGame' };
export type LifecycleCommandData = CreateGameCommandData;

// LifecycleCommandData.ts ✅ точное имя главной экспортируемой сущности
export type CreateGameCommandData = { type: 'CreateGame' };
export type LifecycleCommandData = CreateGameCommandData;
```

```ts
// userRepository.ts ❌ вспомогательная фабрика не отменяет главную сущность
export interface UserRepository {}
export function createUserRepository(): UserRepository {
  return {};
}

// UserRepository.ts ✅ файл назван по главному интерфейсу
export interface UserRepository {}
export function createUserRepository(): UserRepository {
  return {};
}
```

```ts
// constants.ts ✅ допустимое имя для смыслового объединения разных экспортов
export const PAGE_LIMIT = 25;
export const DEFAULT_SORT = 'ASC';
```

- При переименовании файла только изменением регистра на Windows используй
  промежуточное имя, чтобы файловая система и Git корректно зафиксировали
  изменение: `name.ts` → `Name1.ts` → `Name.ts`. После переименования обнови
  регистр пути во всех импортах и проверь отсутствие старого варианта имени.

- Называй SCSS-модуль по шаблону `<имя файла компонента>.module.scss` и
  импортируй его с именем `classes`.

```tsx
// PlaceholderPage.tsx
import classes from './PlaceholderPage.module.scss'; // ✅ Правильно

export function PlaceholderPage() {}
```

## Экспорты

- Не добавляй преждевременные экспорты «на будущее» или ради возможного переиспользования.
- Добавляй экспорт только в одном из двух случаев:
  1. Сущность уже импортируется снаружи текущего модуля.
  2. Экспорт необходим как часть явно определённого публичного API.
- Если функция, тип, константа или компонент используются только внутри текущего файла, оставляй их без `export`.
- Не расширяй публичный API и barrel-файлы без существующего потребителя или явного требования задачи.

```ts
// Файл: src/entities/order/model/prepareOrder.ts

// ❌ Плохо: normalizeOrder экспортируется «на будущее»,
// хотя используется только внутри этого файла
export function prepareOrder(order: Order) {
  return normalizeOrder(order);
}

export function normalizeOrder(order: Order) {
  /* ... */
}
```

```ts
// Файл: src/entities/order/model/prepareOrder.ts

// ✅ Хорошо: наружу экспортируется только часть публичного API
export function prepareOrder(order: Order) {
  return normalizeOrder(order);
}

function normalizeOrder(order: Order) {
  /* ... */
}
```

```ts
// Файл: src/entities/order/index.ts
// ✅ Экспорт оправдан: createOrderDto входит в публичный API слайса
export { createOrderDto } from './model/createOrderDto';

// Файл: src/features/submit-order/model/submitOrder.ts
// ✅ У публичного экспорта есть реальный внешний потребитель
import { createOrderDto } from '#/entities/order';
```

## Комментарии и документация

- Не удаляй и не меняй комментарии, docstring и документацию при рефакторинге, cleanup или оптимизации, если поведение привязанного кода не изменилось.
- Комментарии несут бизнес-контекст и объясняют причины нестандартных решений. Не удаляй их только потому, что код стал понятнее.
- Сохраняй комментарий без изменений, если меняется только форма кода: переименование, перестановка, форматирование, извлечение функции, оптимизация с тем же observable behavior или cleanup вокруг блока, но не самого блока.
- Обновляй или удаляй комментарий, если код существенно переработан, комментарий устарел или описанная логика переехала. При переносе логики перенеси связанный с ней комментарий.
- Перед правкой проверь поведение: если оно не изменилось, оставь комментарий как есть; если изменилось, обнови формулировку или удали комментарий, когда его смысл больше не актуален.

```ts
function someCode(payment: Payment) {
  // код

  // Провайдер может подтвердить платёж после таймаута, поэтому повторяем запрос,
  // сохраняя исходный idempotency key.
  const payment = paymentProvider.retry(payment);

  // другой код
}

// после извлечения кода в функцию

// ❌ Плохо: при извлечении функции потерян бизнес-контекст
function retryPayment(payment: Payment) {
  return paymentProvider.retry(payment);
}

// ✅ Хорошо: комментарий перенесён вместе с неизменившейся логикой
function retryPayment(payment: Payment) {
  // Провайдер может подтвердить платёж после таймаута, поэтому повторяем запрос,
  // сохраняя исходный idempotency key.
  return paymentProvider.retry(payment);
}
```

```ts
function retryPayment(payment: Payment) {
  // Провайдер может подтвердить платёж после таймаута, поэтому повторяем запрос,
  // сохраняя исходный idempotency key.
  return paymentProvider.retry(payment);
}

// после изменения

// ✅ Хорошо: комментарий обновлён, потому что изменилось поведение
function retryPayment(payment: Payment) {
  // После двух таймаутов переводим платёж на ручную проверку вместо третьей попытки.
  return paymentProvider.retryOrRequestManualReview(payment);
}
```

## Feature-Sliced Design

- Если во время написания кода потребовалось импортировать компонент с того же слоя, но из другого слайса, предложи вынести компонент, используемый в двух местах, на слой ниже: например, из `pages` в `widgets`, из `widgets` в `features` и так далее.
- Если потребовалось импортировать компонент из другого слайса слоя `entities`, предложи два варианта:
  1. Добавить импорт в `crossExports.ts` слайса.
  2. Создать новый слайс и сделать `crossExports` уже из него, если компонент относится к новой сущности или подсущности, используемой в разных местах проекта.
- Строго запрещено импортировать стили через alias. Копируй стили в файлы рядом с компонентом либо предлагай создать общий компонент, если видишь дублирование стилей.

```ts
// Файл: src/widgets/order-summary/ui/OrderSummary.tsx

// ❌ Плохо: widgets/order-summary импортирует компонент из другого widgets-слайса
import { PriceBreakdown } from '#/widgets/price-breakdown';

// ✅ Хорошо: сначала предложить вынести переиспользуемый компонент на слой ниже
import { PriceBreakdown } from '#/features/price-breakdown';
```

```ts
// Файл: src/entities/order/ui/OrderAuthor.tsx
// ❌ Плохо: прямой импорт из другого entities-слайса
import { UserAvatar } from '#/entities/user';

// Файл: src/entities/user/crossExports.ts
// ✅ Допустимый вариант: экспорт зависимости через crossExports.ts текущего слайса
export { UserAvatar } from './models/user';

// Файл: src/entities/order/ui/OrderAuthor.tsx
// ✅ Компонент слайса получает зависимость через crossExports.ts
import { UserAvatar } from '#/entities/user/crossExports';
```

```ts
// Файл: src/widgets/order-summary/ui/OrderSummary.tsx

// ❌ Строго запрещено: импорт стилей через alias
import styles from '#/shared/styles/card.module.scss';

// ✅ Стили лежат рядом с компонентом
import styles from './card.module.scss';

// 💡 Если такие стили повторяются, предложи создать переиспользуемый компонент
```

## Тесты

### Не расширять production API ради тестов

- Не добавляй в production-функции и фабрики аргументы, options-поля,
  callbacks или значения по умолчанию, которые нужны только тестам. Это
  относится, например, к подмене repository/service, часов, timers, генератора
  идентификаторов, logger и других системных границ.
- У каждого параметра production API должен быть реальный production-потребитель
  или production-сценарий. Перед добавлением параметра найди этот вызов в
  исходном коде; одного использования из тестов недостаточно.
- Если тесту нужна управляемая зависимость, оставляй production-сигнатуру без
  изменений и подменяй подходящую границу через `vi.mock`, `vi.spyOn`, fake
  timers или `vi.stubGlobal`.
- Не делай обязательную production-конфигурацию необязательной и не добавляй
  fallback только для упрощения test setup. Передавай в тесте настоящее
  контрактное значение либо мокай владельца конфигурации.
- Dependency injection остаётся допустимым, когда зависимость действительно
  передаётся production composition root и является частью архитектурного
  контракта, а не тестовым обходом.

```ts
// ❌ Плохо: production-фабрика расширена только ради unit-теста
function createOrderService(options: {
  now?: () => Date;
  orderRepository?: OrderRepository;
}) {}

// ✅ Хорошо: production получает реальные зависимости, а часы тест контролирует
// через vi.useFakeTimers() и vi.setSystemTime()
function createOrderService(orderRepository: OrderRepository) {}
```

### Unit- и компонентные тесты: один тест — один контракт

Правила этого подраздела относятся только к unit- и компонентным тестам. Они
не распространяются на E2E-тесты: E2E проверяет целостный пользовательский
сценарий и может содержать несколько связанных шагов и проверок.

- Каждый `test` или `it` должен проверять один понятный observable-контракт.
  Это не означает строго один `expect`, но все проверки внутри теста должны
  описывать одну причину возможного падения и требовать одного типа исправления.
- Если проверки могут сломаться независимо и потребовать изменений в разных
  частях алгоритма, разделяй их на отдельные тесты. Например, валидация входных
  данных, вычисление результата, сохранение и отправка уведомления — это разные
  контракты.
- Давай тесту диагностичное имя, по которому из отчёта test runner понятно, что
  именно нарушено, где искать причину и является ли падение ожидаемым следствием
  изменения поведения.
- Связанные тесты группируй через `describe`. Общий сценарий разрешено готовить
  в `beforeEach`, если setup расположен непосредственно внутри этого `describe`
  и остаётся видимым рядом с тестами.
- Не помещай `expect` в `beforeEach`: setup только подготавливает исходное
  состояние, а каждый контракт проверяется внутри именованного теста.
- Не извлекай общий setup в фабрики, билдеры и хелперы, скрывающие структуру
  тестовых данных. Небольшое повторение предпочтительнее неявной подготовки.

```ts
// ❌ Плохо: независимые контракты падают под одним именем
test('processes order', () => {
  expect(isOrderValid(order)).toBe(true);
  expect(calculateOrderTotal(order)).toBe(20);
});

// ✅ Хорошо: общий сценарий виден рядом, причины падения разделены
describe('order calculation', () => {
  let order: Order;

  beforeEach(() => {
    order = {
      items: [{ price: 10, quantity: 2 }],
    };
  });

  test('accepts an order with purchasable items', () => {
    expect(isOrderValid(order)).toBe(true);
  });

  test('calculates the total from price and quantity', () => {
    expect(calculateOrderTotal(order)).toBe(20);
  });
});
```

## Запуск Yarn и package binaries в Windows

- Не запускай Yarn через системные `corepack`, `corepack.cmd` или глобальный
  `yarn`, а package binaries — через системные `npx` или `npx.cmd` даже для
  пробной проверки: в рабочем окружении такие запуски могут завершиться ошибкой
  `Access is denied`.
- Сразу запускай закреплённый в репозитории Yarn через bundled Node. Текущая
  команда для `yarn@4.17.1`:

```powershell
& 'C:\Users\pikac\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.yarn\releases\yarn-4.17.1.cjs' <аргументы Yarn>
```

- Package binaries запускай той же командой через `yarn exec`:

```powershell
& 'C:\Users\pikac\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.yarn\releases\yarn-4.17.1.cjs' exec <package binary> <аргументы>
```

- Перед запуском проверь актуальную версию в поле `packageManager` корневого
  `package.json` и соответствующий файл в `.yarn/releases`. Если путь к bundled
  Node неизвестен, сначала получи его из workspace dependencies, а не переходи
  к системным Corepack или npx.

### Ошибка `uv_os_get_passwd` при запуске `tsx`

- В Codex на Windows bundled Node иногда завершается ещё до запуска проектного
  TypeScript-файла с ошибкой
  `SystemError [ERR_SYSTEM_ERROR]: uv_os_get_passwd returned ENOMEM`. Обычно
  stack trace указывает на `tsx/dist/temporary-directory-*.mjs` или `.cjs`:
  `tsx` пытается получить имя пользователя через `os.userInfo()` для временной
  директории.
- Не переходи из-за этой ошибки на системные Node, Corepack, глобальный Yarn,
  `npx` или `npx.cmd` и не повторяй команду без изменений. Если stack trace
  оборвался внутри `tsx/temporary-directory` до входа в проектный файл, сама
  команда, например миграция или seed, ещё не начала выполняться. Если перед
  ошибкой уже был вывод SQL или приложения, отдельно проверь состояние системы
  и не делай вывод об отсутствии изменений только по этому правилу.
- На этом Windows-хосте ошибка уже повторялась. Поэтому для package scripts,
  которые запускают `tsx` (`db:migrate`, `db:seed` и подобные), сразу используй
  проверенный CommonJS preload, не дожидаясь нового сбоя. Создай через
  `apply_patch` временный файл в корне workspace, например
  `.codex_tsx_windows_user.cjs`:

```js
if (process.geteuid === undefined) {
  Object.defineProperty(process, 'geteuid', {
    configurable: true,
    value: getEffectiveUserId,
  });
}

function getEffectiveUserId() {
  return 0;
}
```

- Этот preload нужен только для обхода выбора временной директории внутри
  `tsx`. Не добавляй его к обычным `test`, `build`, `lint` и другим командам,
  которые успешно работают без `tsx`.
- Передай preload только текущему shell-вызову через `NODE_OPTIONS` и оставь
  запуск закреплённого Yarn через bundled Node:

```powershell
$env:NODE_OPTIONS = '--require=C:\absolute\path\to\workspace\.codex_tsx_windows_user.cjs'
& 'C:\Users\pikac\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.yarn\releases\yarn-4.17.1.cjs' db:migrate
```

- Используй абсолютный путь в `--require`. Не сохраняй `NODE_OPTIONS` в
  конфигурационных файлах и не меняй файлы внутри `node_modules/tsx`. После
  завершения команды удали временный preload через `apply_patch` и проверь
  `git status`, чтобы служебный файл не остался в рабочем дереве.

## Линтер

- После окончания работы над задачей запускай ESLint с `--fix` для затронутых
  файлов.
- В Windows запускай ESLint через bundled Node и закреплённый Yarn:
  `& 'C:\Users\pikac\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' '.yarn\releases\yarn-4.17.1.cjs' exec eslint . --fix`.
- Запускай `eslint . --fix` отдельным shell-вызовом. Не объединяй эту
  команду с предварительными проверками или другими PowerShell-командами в
  одном скрипте: составной запуск может завершиться ошибкой `Access is denied`.
- Для вывода результата и ошибок CLI-команд допустимо использовать `console`.
  В таких случаях добавляй непосредственно перед вызовом
  `// eslint-disable-next-line no-console`.
- Добавляй в сообщения CLI-команд уместные эмодзи, чтобы визуально различать
  успешный результат, предупреждение и ошибку. Не используй несколько эмодзи
  подряд и не добавляй их в сообщения, где они не улучшают восприятие.

## Новые файлы

- Создавай новые файлы с окончаниями строк LF, если формат файла поддерживает выбор окончаний строк.
