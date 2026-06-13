import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { UsageTrackerService } from './usage-tracker.service';

@Injectable()
export class BillingUsageFlushService {
  constructor(
    private readonly usageTracker: UsageTrackerService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BillingUsageFlushService.name);
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'usage-flush',
    waitForCompletion: true,
  })
  async handleDailyUsageFlush(): Promise<void> {
    this.logger.info('Starting daily usage flush');
    try {
      await this.usageTracker.flushDailyUsage();
      this.logger.info('Daily usage flush completed');
    } catch (err) {
      this.logger.error({ err }, 'Daily usage flush failed');
    }
  }
}
