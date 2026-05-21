import { Telegraf, Context } from 'telegraf';
import { config } from './config';
import { logger } from './utils/logger';
import { publishWeatherCard } from './services/telegramPublisher';

const TEASERS = [
  'Сейчас-сейчас, скоро будет 🌅',
  'Минутку, ловлю солнце за хвост ☀️',
  'Уже несу, не уходи никуда 🏃',
  'Сейчас спрошу у небес и вернусь 🌤️',
  'Секундочку, рендерю красоту 🎨',
  'Готовлю карточку, не моргай 👀',
];

function pickTeaser(): string {
  return TEASERS[Math.floor(Math.random() * TEASERS.length)];
}

/**
 * Отправляет "тизер" сообщение и возвращает функцию,
 * которая его удалит. Если удалить не получилось — просто молча игнорим.
 */
async function withTeaser(ctx: Context): Promise<() => Promise<void>> {
  try {
    const msg = await ctx.reply(pickTeaser());
    return async () => {
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, msg.message_id);
      } catch (err) {
        logger.warn('Failed to delete teaser message:', err);
      }
    };
  } catch (err) {
    logger.warn('Failed to send teaser message:', err);
    return async () => {};
  }
}

export function createBot(): Telegraf {
  const bot = new Telegraf(config.botToken);

  bot.start((ctx) =>
    ctx.reply(
      'Привет! Я публикую прогноз и опрос про закат каждый день в 12:00.\n\n' +
        'Команды:\n' +
        '/today — карточка + опрос в основной чат\n' +
        '/weather — карточка погоды без опроса (отвечу в этом чате)',
    ),
  );

  bot.command('today', async (ctx) => {
    logger.info(`/today triggered by ${ctx.from?.id} in chat ${ctx.chat.id}`);
    const dismiss = await withTeaser(ctx);
    try {
      await publishWeatherCard(bot, {
        chatId: ctx.chat.id,
        withPoll: true,
      });
    } catch (err) {
      logger.error('/today failed:', err);
      await ctx.reply('Не получилось собрать карточку 😿');
    } finally {
      await dismiss();
    }
  });

  bot.command('chatid', async (ctx) => {
    const chat = ctx.chat;
    logger.info(`/chatid in chat ${chat.id} (${chat.type})`);
    await ctx.reply(
      `chat.id: <code>${chat.id}</code>\n` +
        `type: ${chat.type}\n` +
        `from.id: <code>${ctx.from?.id}</code>`,
      { parse_mode: 'HTML' },
    );
  });

  bot.command('weather', async (ctx) => {
    logger.info(`/weather triggered by ${ctx.from?.id} in chat ${ctx.chat.id}`);
    const dismiss = await withTeaser(ctx);
    try {
      await publishWeatherCard(bot, { chatId: ctx.chat.id, withPoll: false });
    } catch (err) {
      logger.error('/weather failed:', err);
      await ctx.reply('Не получилось собрать карточку 😿');
    } finally {
      await dismiss();
    }
  });

  bot.catch((err) => {
    logger.error('Bot error:', err);
  });

  return bot;
}
