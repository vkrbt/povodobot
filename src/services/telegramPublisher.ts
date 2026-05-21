import { Telegraf } from 'telegraf';
import { InputFile } from 'telegraf/types';
import fs from 'fs';
import dayjs from 'dayjs';
import { config } from '../config';
import { logger } from '../utils/logger';
import { fetchWeather, WeatherSnapshot } from './weatherService';
import { renderCard } from './cardRenderer';

function buildCaption(weather: WeatherSnapshot): string {
  const sunset = dayjs(weather.sunset).format('HH:mm');
  return `Закат в <b>${sunset}</b>`;
}

function pickPollTemplate(): string {
  const templates = config.poll.questionTemplates;
  return templates[Math.floor(Math.random() * templates.length)];
}

function buildPollQuestion(weather: WeatherSnapshot): string {
  const sunset = dayjs(weather.sunset).format('HH:mm');
  return pickPollTemplate()
    .replace('{sunset}', sunset)
    .replace('{meetBefore}', String(config.poll.meetBeforeMinutes));
}

export interface PublishOptions {
  /**
   * Куда отправлять. По умолчанию — все чаты из config.chatIds.
   * Можно передать один id или массив.
   */
  chatId?: string | number | Array<string | number>;
  /** Публиковать ли опрос после карточки. По умолчанию true. */
  withPoll?: boolean;
}

function asArray(v: PublishOptions['chatId']): Array<string | number> {
  if (v === undefined) return config.chatIds;
  return Array.isArray(v) ? v : [v];
}

export async function publishWeatherCard(
  bot: Telegraf,
  options: PublishOptions = {},
): Promise<void> {
  const targets = asArray(options.chatId);
  const withPoll = options.withPoll ?? true;

  logger.info(
    `Publishing weather card to ${targets.length} chat(s): [${targets.join(', ')}] (withPoll=${withPoll})`,
  );

  const weather = await fetchWeather();
  const cardPath = await renderCard(weather);
  const caption = buildCaption(weather);
  const pollQuestion = withPoll ? buildPollQuestion(weather) : '';

  let okCount = 0;
  const failures: Array<{ target: string | number; error: unknown }> = [];

  for (const target of targets) {
    try {
      // ВАЖНО: создаём новый ReadStream под каждый чат — после первого
      // sendPhoto стрим закрывается, переиспользовать нельзя.
      const photo: InputFile = { source: fs.createReadStream(cardPath) };
      await bot.telegram.sendPhoto(target, photo, {
        caption,
        parse_mode: 'HTML',
      });
      logger.info(`Card photo sent to ${target}`);

      if (withPoll) {
        await bot.telegram.sendPoll(target, pollQuestion, config.poll.options, {
          is_anonymous: false,
          allows_multiple_answers: false,
        });
        logger.info(`Poll sent to ${target}`);
      }
      okCount += 1;
    } catch (err) {
      // Логируем подробно — code, description, response от Telegram.
      const e = err as {
        message?: string;
        code?: number;
        description?: string;
        response?: unknown;
      };
      logger.error(
        `Failed to publish to ${target}: ${e.message ?? err} ` +
          `(code=${e.code ?? '-'}, description=${e.description ?? '-'})`,
      );
      if (e.response) {
        logger.error(`Telegram response for ${target}: ${JSON.stringify(e.response)}`);
      }
      failures.push({ target, error: err });
    }
  }

  logger.info(
    `Publish summary: ok=${okCount}/${targets.length}, failed=${failures.length}`,
  );

  // Если ни один чат не получил карточку — это явная ошибка, делаем процесс
  // упавшим, чтобы GitHub Actions подсветил жёлтый/красный значок.
  if (okCount === 0 && targets.length > 0) {
    throw new Error(
      `All ${targets.length} target chat(s) failed. See logs above.`,
    );
  }
}

/** Ежедневный пайплайн: карточка + опрос во все настроенные чаты. */
export function publishDailyUpdate(bot: Telegraf): Promise<void> {
  return publishWeatherCard(bot, { withPoll: true });
}
