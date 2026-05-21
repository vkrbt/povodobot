# meet-bot

Telegram-бот, который ежедневно в 12:00 по `Europe/Minsk`:

- получает прогноз погоды и время заката для Минска через Open-Meteo;
- рендерит квадратную HTML-карточку и скриншотит её через Puppeteer;
- отправляет PNG-карточку в указанный чат;
- публикует неанонимный опрос `Кто сегодня идёт смотреть закат?`.

## Стек

- Node.js 18+
- TypeScript
- [`Telegraf`](https://telegraf.js.org/)
- [`Puppeteer`](https://pptr.dev/)
- [`node-cron`](https://www.npmjs.com/package/node-cron)
- Open-Meteo (без API-ключа)

## Установка

```bash
npm install
cp .env.example .env
# заполни BOT_TOKEN и CHAT_ID
```

## Запуск

```bash
# dev режим
npm run dev

# один прогон без планировщика (опубликовать карточку прямо сейчас)
npm run today

# прод
npm run build
npm start
```

## Команды бота

- `/start` — приветствие
- `/chatid` — узнать ID текущего чата
- `/today` — собрать и опубликовать карточку **и опрос** во все чаты из `CHAT_IDS`
- `/weather` — прислать карточку погоды **без опроса** в текущий чат

## Несколько целевых чатов

[`CHAT_IDS`](.env.example:5) — список через запятую:

```env
CHAT_IDS=-1001234567890,-1009876543210,123456789
```

Бот отправит карточку и опрос в каждый чат. Если один из чатов недоступен — он просто пропустится с warn-логом, остальные доставятся. Можно использовать и `CHAT_ID` (один чат) для обратной совместимости.

## Расписание

Контролируется переменной [`CRON_SCHEDULE`](.env.example:5). По умолчанию `0 12 * * *` в зоне [`TIMEZONE`](.env.example:6).

## Структура

- [`src/index.ts`](src/index.ts) — точка входа
- [`src/bot.ts`](src/bot.ts) — создание [`new Telegraf()`](src/bot.ts:6) и команды
- [`src/scheduler.ts`](src/scheduler.ts) — ежедневный cron
- [`src/services/weatherService.ts`](src/services/weatherService.ts) — Open-Meteo
- [`src/services/cardRenderer.ts`](src/services/cardRenderer.ts) — HTML + Puppeteer
- [`src/services/telegramPublisher.ts`](src/services/telegramPublisher.ts) — отправка фото и опроса
- [`src/templates/weatherCard.html`](src/templates/weatherCard.html) — шаблон карточки
- [`src/utils/formatWeather.ts`](src/utils/formatWeather.ts) — маппинг WMO weather codes

## Заметки

- На Linux для Puppeteer может понадобиться установить системные зависимости Chromium.
- Чат должен быть доступен боту, бот должен иметь право отправлять опросы.
