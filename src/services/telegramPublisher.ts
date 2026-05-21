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
    `Publishing weather card to [${targets.join(', ')}] (withPoll=${withPoll})`,
  );

  const weather = await fetchWeather();
  const cardPath = await renderCard(weather);
  const caption = buildCaption(weather);

  for (const target of targets) {
    try {
      const photo: InputFile = { source: fs.createReadStream(cardPath) };
      await bot.telegram.sendPhoto(target, photo, {
        caption,
        parse_mode: 'HTML',
      });
      logger.info(`Card photo sent to ${target}`);

      if (withPoll) {
        await bot.telegram.sendPoll(
          target,
          buildPollQuestion(weather),
          config.poll.options,
          {
            is_anonymous: false,
            allows_multiple_answers: false,
          },
        );
        logger.info(`Poll sent to ${target}`);
      }
    } catch (err) {
      logger.error(`Failed to publish to ${target}:`, err);
    }
  }
}

/** Ежедневный пайплайн: карточка + опрос во все настроенные чаты. */
export function publishDailyUpdate(bot: Telegraf): Promise<void> {
  return publishWeatherCard(bot, { withPoll: true });
}
