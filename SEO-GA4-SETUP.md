# Настройка аналитики и поисковой видимости — «Сибирь Проект»

Домен: https://sibirproekt72.ru/ · GA4: `G-8BYMKVZHGT`

## 1. Google Analytics 4 — микроконверсии

Все события отправляются через `gtag('event', ...)`, а до загрузки gtag — в `window.dataLayer` (ничего не теряется).

| Событие | Триггер | Параметры | Файл |
|---|---|---|---|
| `calculator_calculate` | Валидный расчёт в калькуляторе, задержка 1 с, первичный рендер не учитывается | `service`, `law`, `guarantee_type`, `amount`, `term_days`, `price`, `event_label` | `js/calculator.js` |
| `calculator_lead` | Кнопки «Скопировать расчёт» и «Отправить расчёт в анонимный чат» | `method: copy\|chat`, `value`, `amount`, `term_days` | `js/calculator.js` |
| `file_download` | Клик по любой ссылке `*.pdf` (основная кнопка, `checklist.html`, exit-popup) | `file_name`, `file_extension: pdf`, `link_url`, `event_label` | `js/main.js` |
| `phone_copy` | Кнопка «Скопировать номер» (hero на главной + липкая панель на всех страницах) | `phone`, `value: 1`, `event_label` | `js/main.js` |
| `phone_click` | Клик по ссылке `tel:` (дополнительный сигнал) | `phone`, `event_label` | `js/main.js` |
| `chat_open` | Клик по `[data-chat-open]` (в т.ч. кнопки exit-popup) или лаунчеру чата, не чаще 1 раза с места за сессию | `method: cta\|launcher`, `event_label` | `js/main.js` |

Уже были: `article_open`, `article_read`, `exit_intent_shown`, `exit_intent_choice`.

Exit-intent (`js/main.js`): 4 сценария, один показ за сессию (`sessionStorage`), ротация между сессиями (`localStorage`). Сегменты: `calculator` (посещён блок `#calculator` → скидка на гарантию), `urgent` (страницы об обжаловании и банковских гарантиях → экстренная помощь), `default` (чередование чек-листа и анонимного аудита), `debug` (`?exitpopup=1&variant=1..4`). В `exit_intent_shown` передаются `variant` и `segment`; кнопки чата в popup открывают чат с заготовкой в поле ввода и попадают в `chat_open` с `event_label: exitpop`.

### Состояние в интерфейсе GA4 (проверено 22.11.2026)

- Ключевые события уже отмечены: `calculator_lead`, `file_download` (и старое `purchase`).
- `calculator_calculate`, `phone_copy`, `chat_open`, `phone_click` реально отправляются и
  видны в **Отчёты → Обзор в режиме реального времени**, но пока отсутствуют в списке
  **Админ → События** (задержка обработки GA4). Когда появятся — отметить звёздочкой.
- Все пять целевых событий (`calculator_calculate`, `calculator_lead`, `phone_copy`,
  `phone_click`, `chat_open`) подтверждены в Realtime на живом сайте.
- При наличии Google Ads остаётся импортировать ключевые события в Ads (не делалось).

### Проверка на сайте

1. Открыть сайт в браузере, консоль → `dataLayer`.
2. Провести расчёт: должно появиться `calculator_calculate` с параметрами.
3. Нажать «Скопировать расчёт» → `calculator_lead` (`method: copy`).
4. Скачать PDF → `file_download`.
5. Нажать «Скопировать номер» → `phone_copy`.
6. Нажать «Анонимный чат» → `chat_open`.

## 2. Google Search Console (выполнено 22.11.2026)

- Ресурс `https://sibirproekt72.ru/` добавлен и подтверждён. Мета-тег
  `google-site-verification` больше не нужен: плейсхолдер удалён из `index.html`
  и переопубликован на сайте.
- **Индексация → Файлы sitemap.xml** → отправлен `https://sibirproekt72.ru/sitemap.xml`.
- Статус файла: **Успешно**, последняя обработка 22 нояб. 2026 г.,
  обнаружено **23 страницы**.
- Побочные старые записи (две с XML вместо URL и архив `sitemap.3899296.xml.gz`)
  удалены из GSC — осталась только рабочая `/sitemap.xml`.

## 3. Индексация и дубли

`robots.txt`:
- `Allow: /` — все страницы услуг открыты, включая 44-ФЗ, 223-ФЗ, 615-ПП, ЭЦП/МЧД и ФАС.
- `Disallow: /*?` — закрыты технические query-параметры (`?exitpopup=1` и т.п.).
- Калькулятор не меняет URL, состояние живёт только в DOM → дублей не создаёт.
- Явно разрешены `GPTBot`, `OAI-SearchBot`, `PerplexityBot`, `Google-Extended`,
  а также `ChatGPT-User`, `ClaudeBot`, `Perplexity-User`, `Applebot-Extended`, `YandexGPT`.

`sitemap.xml`: добавлены ранее отсутствовавшие страницы
`articles/nezavisimaya-garantiya-bez-otkaza.html` и
`news/delovaya-reputaciya-stroitelnyh-zakupok-44-fz.html`, обновлены `lastmod`.
`checklist.html` остаётся `noindex, follow` и в карту не входит.

Темы распределены по существующим страницам (отдельные URL под 44-ФЗ/223-ФЗ/615-ПП/МЧД
не создавались намеренно — это дало бы дубли):
- 44-ФЗ, 223-ФЗ, 615-ПП → `/uslugi/bankovskie-garantii.html`, `/uslugi/tendernoe-soprovozhdenie.html`
- ЭЦП, МЧД → `/uslugi/ecp.html`
- Жалобы в ФАС → `/uslugi/zashchita-fas.html`

## 4. Скорость

- `js/main.js` и `js/calculator.js` загружаются с `defer`; калькулятор вынесен в отдельный файл
  и подключается только на главной (остальные страницы его не скачивают).
- Бегущая строка — чистый CSS с `translate3d`, `will-change: transform`, `contain: layout paint`;
  анимация ставится на паузу вне экрана через IntersectionObserver.
- Canvas-«пыль» отключена на мобильных и при `prefers-reduced-motion`.
- Шрифты Google загружаются без блокировки рендера (`preload` + `media="print"` + `noscript`).
- Чат-виджет (22 КБ JS + инъекция CSS) загружается в `requestIdleCallback`;
  при клике по чату загружается сразу.
- Локальный Lighthouse после исправлений: Accessibility 1.00, Best Practices 1.00, SEO 1.00,
  ошибок 0 (performance/LCP в режиме snapshot не измеряется).
- PageSpeed Insights API без ключа вернул 429 (квота исчерпана), веб-интерфейс не завершил
  анализ — field-метрики LCP получить не удалось; цель LCP < 2 с на мобильном остаётся
  непроверенной на реальных устройствах; повторить позже.
