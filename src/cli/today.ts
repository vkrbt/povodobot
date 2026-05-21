import { Telegraf } from 'telegraf';
import { config } from '../config';
import { logger } from '../utils/logger';
import { publishDailyUpdate } from '../services/telegramPublisher';

async function main(): Promise<void> {
  logger.info(
    `One-shot publish starting. Configured targets (${config.chatIds.length}): ` +
      `[${config.chatIds.join(', ')}]`,
  );
  const bot = new Telegraf(config.botToken);
  try {
    await publishDailyUpdate(bot);
    logger.info('One-shot publish finished');
    process.exit(0);
  } catch (err) {
    logger.error('One-shot publish failed:', err);
    process.exit(1);
  }
}

main();
