import 'dotenv/config';
import path from 'path';

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

function asNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) {
    throw new Error(`Env ${name} must be a number, got: ${raw}`);
  }
  return n;
}

function asChatIds(): string[] {
  // Принимаем CHAT_IDS (несколько через запятую) и/или CHAT_ID (один — для обратной совместимости)
  const multi = process.env.CHAT_IDS ?? '';
  const single = process.env.CHAT_ID ?? '';
  const raw = [...multi.split(','), single]
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  const unique = Array.from(new Set(raw));
  if (unique.length === 0) {
    throw new Error('Missing required env: CHAT_IDS (или CHAT_ID)');
  }
  return unique;
}

export const config = {
  botToken: required('BOT_TOKEN'),
  /** Список целевых чатов. Первый в списке считается "основным". */
  chatIds: asChatIds(),
  cronSchedule: optional('CRON_SCHEDULE', '0 12 * * *'),
  timezone: optional('TIMEZONE', 'Europe/Minsk'),
  city: {
    name: optional('CITY_NAME', 'Минск'),
    latitude: asNumber('LATITUDE', 53.9),
    longitude: asNumber('LONGITUDE', 27.5667),
  },
  card: {
    width: asNumber('CARD_WIDTH', 1080),
    height: asNumber('CARD_HEIGHT', 1080),
    outputPath: path.resolve(
      process.cwd(),
      optional('OUTPUT_PATH', 'output/weather-card.png'),
    ),
  },
  poll: {
    /**
     * Сколько минут до заката встречаемся. Подставляется в {meetBefore}.
     */
    meetBeforeMinutes: asNumber('POLL_MEET_BEFORE_MIN', 20),
    /**
     * Несколько вариантов вопроса — каждый день выбирается случайный.
     * Плейсхолдеры: {sunset} — время заката HH:mm, {meetBefore} — минуты.
     * Можно переопределить через POLL_QUESTIONS (варианты через `|`)
     * или одним вариантом через POLL_QUESTION.
     */
    questionTemplates: (() => {
      const env = process.env.POLL_QUESTIONS ?? process.env.POLL_QUESTION ?? '';
      const fromEnv = env
        .split('|')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (fromEnv.length > 0) return fromEnv;
      return [
        'Смотрим закат сегодня в {sunset}, встречаемся за ~{meetBefore} минут до заката',
        'Сегодня закат в {sunset} — сбор за {meetBefore} минут до. Кто с нами?',
        'Закат сегодня в {sunset}. Встречаемся минут за {meetBefore} — кто идёт?',
        'Солнце садится в {sunset}, выходим за ~{meetBefore} минут. Идём смотреть?',
        'Сегодня закат в {sunset}. Встреча за {meetBefore} мин до. Как настрой?',
      ];
    })(),
    options: [
      optional('POLL_OPTION_YES', '🌇 Дааа, смотрим вместе'),
      optional('POLL_OPTION_CHAT', '💬 Смотрю с вами, но в чате'),
      optional('POLL_OPTION_NO', '🙅 Не смотрю'),
    ],
  },
};

export type AppConfig = typeof config;
