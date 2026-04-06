# YCS агент — плавающая кнопка (`copilot-trigger`): логика и состояния

Документ для передачи коллеге: откуда берётся кнопка, какие у неё состояния (визуальные + a11y), как связана с React-прототипом.

---

## 1. Где лежит реализация

| Слой | Путь в репозитории |
|------|---------------------|
| Разметка + поведение кнопки, глаза, опциональный сайдбар | `CopilotRobotEmbed/copilot-robot.js` |
| Стили кнопки и панели | `CopilotRobotEmbed/copilot-robot.css` |
| Смещение от низа, интро-бабл, скрытие при открытом дровере | `CopilotRobotEmbed/copilot-robot-prototype-layout.css` |
| Подключение в прототипе, `panel: false`, колбэк, интро | `../CopilotPrototypePageV1.tsx` |

Скрипт грузится динамически (`copilot-robot.js?url`), глобал: `window.CopilotRobot.init(...)`.

---

## 2. HTML/DOM контракт кнопки

Корневой контейнер:

- `div.copilot-robot-root` + `data-copilot-robot`
- CSS-переменная на корне: `--cr-z` (z-index базы)

Кнопка (создаётся в `copilot-robot.js`):

```html
<button
  type="button"
  class="copilot-trigger"
  data-cr-trigger
  aria-label="…"
  aria-expanded="false|true"
  title="…"
  aria-controls="copilot-robot-sidebar-…"
>
  <!-- span.copilot-face + SVG глаз -->
</button>
```

- **`data-cr-trigger`** — селектор для поиска кнопки в JS.
- При **`panel: true`** и наличии сайдбара на кнопку вешается **`aria-controls`** = `id` у `aside.copilot-sidebar`.
- В прототипе Copilot используется **`panel: false`** → сайдбара у робота нет, **`aria-controls` не задаётся** (в коде это поле выставляется только если есть `sidebar`).

---

## 3. Состояния кнопки (сводка)

### 3.1. Логическое состояние (JS + a11y)

| Состояние | Условие | `aria-expanded` | Примечание |
|-----------|---------|-------------------|------------|
| Закрыто (панель робота) | Сайдбар не `.is-open` или `panel: false` | `false` | В прототипе панель робота отключена — всегда `false` с точки зрения embed |
| Открыто (панель робота) | `panel: true` и сайдбар `.is-open` | `true` | В Copilot прототипе **не используется** |
| Фокус после закрытия панели | После `close()` | `false` | `trigger.focus()` |

В **текущем прототипе** клик по кнопке **не** открывает сайдбар робота: `panel: false`, вызывается **`onTriggerClick`** → открывается React **`CopilotHelpDrawer`**.

### 3.2. Визуальные состояния (CSS, `copilot-robot.css`)

Селектор базы: `.copilot-robot-root .copilot-trigger`.

| Состояние | CSS |
|-----------|-----|
| Покой | `position: fixed`, `56×56`, круг, фон `--copilot-trigger-face` / `#313136`, тень |
| `:hover` | `transform: scale(1.05)`, усиленная тень |
| `:active` | `scale(0.98)` |
| `:focus-visible` | `outline` из `--color-ds-stroke-focus` |
| `[aria-expanded="true"]` | `scale(0.96)`, меньшая тень (актуально при `panel: true`) |

`prefers-reduced-motion: reduce`: у кнопки и глаз отключаются `transition`.

### 3.3. Позиция на экране (прототип)

В `copilot-robot-prototype-layout.css`:

- `right: 24px`, `bottom: var(--copilot-trigger-bottom, 24px)`.
- React в `CopilotPrototypePageV1` выставляет **`--copilot-trigger-bottom`** на `<html>`: высота **фиксированного футера** + `24px` (через `ResizeObserver` на `fixedFooterRef`), иначе просто `24px`.

### 3.4. Скрытие кнопки

На `<html>` вешается класс **`copilot-help-drawer-open`**, когда открыт дровер помощи. Тогда:

```css
html.copilot-help-drawer-open .copilot-robot-root .copilot-trigger { display: none !important; }
```

Та же строка скрывает **интро-бабл** `.copilot-intro-bubble`.

---

## 4. Поведение «глаза следят за курсором»

В `copilot-robot.js`:

- Слушатели: `document` — `mousemove`, `touchmove` (passive).
- **`updateEyes`**: переводит координаты курсора в систему SVG 50×50, сдвигает группы `.copilot-eye-left` / `.copilot-eye-right` через `transform: translate(tx, ty)` с ограничением **maxEyeOffset = 2**.
- **Не двигаются глаза**, если:
  - `prefers-reduced-motion: reduce`, или
  - открыт сайдбар робота (`.copilot-sidebar.is-open`) — в прототипе с `panel: false` сайдбара нет, условие обычно не срабатывает.

---

## 5. Режим `panel: true` (встроенный сайдбар робота)

Если передать **`panel: true`** (дефолт в `copilot-robot.js`):

- Рядом с кнопкой рендерятся `.copilot-backdrop` и `.copilot-sidebar` (dialog).
- **Клик по кнопке** → `toggle()` / `open()` / `close()`.
- **Открытие `open()`**: снять `hidden`, `aria-hidden="false"`, класс `is-open` на backdrop и sidebar, **`aria-expanded="true"`**, `document.body.style.overflow = 'hidden'`, фокус на кнопку закрытия.
- **Закрытие `close()`**: анимация `transform`, по `transitionend` или таймаут **400ms** (или сразу при reduced motion), затем `hidden` + **`aria-expanded="false"`** + фокус обратно на trigger.
- **Escape** закрывает панель, если она открыта.
- Клик по **backdrop** — закрытие.

API: `{ root, open, close, toggle, isOpen, destroy, setSidebarBodyHTML }`.

---

## 6. Режим прототипа Copilot: `panel: false`

Фрагмент из `CopilotPrototypePageV1.tsx` (смысл, не дословная копия):

- `panel: false`
- `zIndex: 12000`
- `triggerTitle: 'YCS агент'`
- `triggerAriaLabel: 'Открыть YCS агента'`
- `onTriggerClick`: скрыть интро-бабл + `setCopilotDrawerOpen(true)` (React drawer).

Итог для DOM кнопки в прототипе:

- **`title`** = «YCS агент»
- **`aria-label`** = «Открыть YCS агента»
- **`aria-expanded`** остаётся **`false`** (сайдбар робота не открывается).

---

## 7. Интро-бабл (рядом с кнопкой)

Не часть `copilot-robot.js`, а **доп. DOM** в `CopilotPrototypePageV1.tsx`:

- `div.copilot-intro-bubble` с `role="status"`, текст из `COPILOT_INTRO_TEXT` («Помогу настроить проект»).
- Появление: два `requestAnimationFrame` → класс **`is-visible`**.
- Автоскрытие через **8000 ms** или крестик / клик по триггеру (`hideIntro`).
- Позиция: `copilot-robot-prototype-layout.css` — над кнопкой, с учётом `--copilot-trigger-bottom`.

---

## 8. Опции `CopilotRobot.init` (релевантные кнопке)

| Опция | По умолчанию | Назначение |
|--------|--------------|------------|
| `mount` | `document.body` | Куда вставить `.copilot-robot-root` |
| `zIndex` | `1000` | Пишется в `--cr-z` на корне |
| `panel` | `true` | `false` — только кнопка + `onTriggerClick` |
| `triggerTitle` | `'Помощник'` | HTML `title` |
| `triggerAriaLabel` | `'Открыть помощника'` | `aria-label` |
| `onTriggerClick` | `null` | Если `panel === false`, вызывается при клике; аргумент `{ open, close, toggle, root }` |

---

## 9. Уничтожение

`api.destroy()`:

- снимает слушатели `mousemove` / `touchmove` / `keydown`;
- снимает `click` с trigger;
- восстанавливает `overflow` у `body`, если панель была открыта;
- удаляет `root` из DOM.

При размонтировании страницы прототипа это вызывается в `useEffect` cleanup.

---

## 10. Зависимости от темы ДС

Стили кнопки и оверлея используют токены вроде `var(--color-ds-text-primary)`, `var(--color-ds-stroke-focus)`, `var(--color-ds-primitive-black-alfa-30)`. В прототипе тема задаётся через `initCustomTheme(BUSINESS | BUSINESS_DARK)`.

---

*Файл сгенерирован как сопроводительная спецификация к коду в этой же папке и в `CopilotPrototypePageV1.tsx`.*
