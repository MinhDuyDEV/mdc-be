import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';
import { OutboxService } from '../../outbox/outbox.service';

@Injectable()
export class UsageThresholdService {
  private readonly notifiedCache: Map<string, number> = new Map();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

  constructor(
    private readonly outboxService: OutboxService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UsageThresholdService.name);
  }

  async checkThreshold(
    companyId: string,
    featureKey: string,
    currentValue: number,
    threshold: number,
  ): Promise<void> {
    if (threshold <= 0) return;

    const percentage = Math.round((currentValue / threshold) * 100);

    // Check if already notified for this threshold band (80%, 90%, 100%)
    const roundedBand = Math.floor(percentage / 10) * 10;
    if (roundedBand < 80) return;

    const cacheKey = this.buildCacheKey(companyId, featureKey, roundedBand);
    const lastNotified = this.notifiedCache.get(cacheKey);
    const now = Date.now();

    if (lastNotified && now - lastNotified < this.CACHE_TTL_MS) return;

    this.notifiedCache.set(cacheKey, now);

    // Emit outbox event for threshold reached
    // The tx parameter is a mock — threshold events don't need a real transaction
    await this.outboxService.emit({} as Prisma.TransactionClient, {
      eventType: 'UsageThresholdReached',
      aggregateType: 'Usage',
      aggregateId: `${companyId}:${featureKey}`,
      payload: {
        companyId,
        meterEventName: featureKey,
        currentValue,
        threshold,
      },
    });

    this.logger.warn(
      {
        companyId,
        featureKey,
        currentValue,
        threshold,
        percentage: roundedBand,
      },
      'Usage threshold reached',
    );
  }

  private buildCacheKey(
    companyId: string,
    featureKey: string,
    percentage: number,
  ): string {
    return `${companyId}:${featureKey}:${percentage}`;
  }
}
