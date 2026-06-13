import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { PrismaTransaction } from '../../infra/prisma';
import { OutboxService } from '../../outbox/outbox.service';

@Injectable()
export class UsageThresholdService {
  private readonly notifiedCache: Map<string, number> = new Map();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
  private callCount = 0;

  constructor(
    private readonly prisma: PrismaService,
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

    // Emit outbox event inside a real Prisma transaction
    await this.prisma.$transaction(async (tx: PrismaTransaction) => {
      await this.outboxService.emit(tx, {
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

    // LRU-like cache eviction: every 100 calls, purge stale entries
    this.callCount++;
    if (this.callCount >= 100) {
      this.callCount = 0;
      this.evictStaleCacheEntries();
    }
  }

  /**
   * Removes entries older than CACHE_TTL_MS from the in-memory cache.
   * Prevents unbounded memory growth while keeping hot entries.
   */
  private evictStaleCacheEntries(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.notifiedCache) {
      if (now - timestamp >= this.CACHE_TTL_MS) {
        this.notifiedCache.delete(key);
      }
    }
  }

  private buildCacheKey(
    companyId: string,
    featureKey: string,
    percentage: number,
  ): string {
    return `${companyId}:${featureKey}:${percentage}`;
  }
}
