# Деплой бота

Сейчас выбран **гибридный путь**: ежедневный пост публикуется через GitHub Actions (бесплатно), а команды `/today`, `/weather`, `/chatid` пока запускаются локально (по желанию). Когда захочется, чтобы команды тоже работали 24/7, перейди на полноценный VM — раздел в конце документа.

---

## A. GitHub Actions (бесплатный планировщик)

Workflow [`.github/workflows/daily-sunset.yml`](.github/workflows/daily-sunset.yml) каждый день в **12:00 по Минску** (`09:00 UTC`) запускает `npm run today` — собирает карточку, рендерит её через Puppeteer на runner-е GitHub и шлёт в каждый чат из `CHAT_IDS` вместе с опросом.

### Стоимость
- Public репо: **неограниченно бесплатно**.
- Private репо: **2000 минут/месяц** бесплатно, мы тратим ~2 минуты/день = ~60 минут/месяц. С запасом.

### Шаг 1. Запушить репо на GitHub
Если ещё не запушил:
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create meet-bot --private --source=. --push
# или вручную через https://github.com/new
```

### Шаг 2. Добавить секреты
GitHub → твой репо → **Settings → Secrets and variables → Actions → New repository secret**.

Создай два секрета:

| Имя | Значение |
|-----|----------|
| `BOT_TOKEN` | Токен бота из @BotFather |
| `CHAT_IDS` | `-1001234567890,-1009876543210` (через запятую) |

### Шаг 3. Проверить workflow вручную
GitHub → **Actions → Daily sunset post → Run workflow → Run**.

Через 30–60 секунд в указанные чаты должна прийти карточка и опрос. Если что-то не так — открой run и смотри логи.

### Шаг 4. Дальше работает само
Cron `0 9 * * *` срабатывает ежедневно. **Учти:** GH Actions cron может опаздывать до 15 минут при пиковой нагрузке — это документированное поведение, не баг.

### Поменять время
Поправь строку `- cron: '0 9 * * *'` в [`.github/workflows/daily-sunset.yml`](.github/workflows/daily-sunset.yml:5). Cron в GH Actions всегда в UTC, считай так:
- 12:00 Europe/Minsk → 09:00 UTC → `0 9 * * *`
- 21:00 Europe/Minsk → 18:00 UTC → `0 18 * * *`

### Что НЕ работает в этом режиме
- `/today`, `/weather`, `/chatid` — команды Telegram. Они требуют постоянного процесса, а Actions-раннер живёт 2 минуты и умирает.
- Если нужно дёрнуть руками — запусти workflow через UI: **Actions → Daily sunset post → Run workflow**.

---

## B. Локально по желанию (для тестов и `/chatid`)

Чтобы быстро узнать `CHAT_IDS` или проверить карточку:

```bash
npm install
cp .env.example .env
# подставь BOT_TOKEN и CHAT_IDS

# разовый пост (то же что делает GH Actions)
npm run today

# полный режим с командами и cron внутри (Mac/Linux)
npm run dev
```
В режиме `npm run dev` бот реагирует на `/today`, `/weather`, `/chatid`. После того как узнал ID — `Ctrl+C` и можно жить только на GH Actions.

---

## C. Когда захочется полный 24/7 функционал

Варианты, что есть в репо для апгрейда:
- [`Dockerfile`](Dockerfile) + [`fly.toml`](fly.toml) — Fly.io (~3 USD/мес за `shared-cpu-1x` 512MB).
- Oracle Cloud Always Free ARM VM — реально бесплатно навсегда, но требует регистрации с картой и иногда сложно поймать ARM-инстанс. Шаги:
  1. Регистрируешься на cloud.oracle.com (Always Free).
  2. Берёшь Ubuntu 22.04 ARM Ampere A1 (4 OCPU / 24GB бесплатно).
  3. На машине: `apt install -y nodejs chromium-browser fonts-noto-color-emoji`.
  4. Клонируешь репо, `npm install && npm run build`.
  5. Создаёшь `/etc/systemd/system/meet-bot.service`:
     ```ini
     [Unit]
     Description=Meet bot
     After=network.target
     [Service]
     WorkingDirectory=/home/ubuntu/meet-bot
     EnvironmentFile=/home/ubuntu/meet-bot/.env
     ExecStart=/usr/bin/node dist/index.js
     Restart=always
     User=ubuntu
     [Install]
     WantedBy=multi-user.target
     ```
  6. `systemctl enable --now meet-bot`.

Как только перейдёшь на VM, выключи GH Actions workflow или поменяй cron в env, чтобы не было дублей.
