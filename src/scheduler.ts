import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { config } from './config';
import { logger } from './utils/logger';
import { publishDailyUpdate } from './services/telegramPublisher';

export function startScheduler(bot: Telegraf): void {
  if (!cron.validate(config.cronSchedule)) {
    throw new Error(`Invalid CRON_SCHEDULE: ${config.cronSchedule}`);
  }

  logger.info(
    `Scheduling daily job: "${config.cronSchedule}" (${config.timezone})`,
  );

  cron.schedule(
    config.cronSchedule,
    async () => {
      try {
        await publishDailyUpdate(bot);
      } catch (err) {
        logger.error('Scheduled job failed:', err);
      }
    },
    { timezone: config.timezone },
  );
}
