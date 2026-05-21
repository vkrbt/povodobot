import { createBot } from './bot';
import { startScheduler } from './scheduler';
import { logger } from './utils/logger';

async function main(): Promise<void> {
  const bot = createBot();
  startScheduler(bot);

  await bot.launch();
  logger.info('Bot started');

  const shutdown = (signal: string) => {
    logger.info(`Received ${signal}, stopping bot`);
    bot.stop(signal);
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal error:', err);
  process.exit(1);
});
