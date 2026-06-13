import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { STRIPE_PORT, type StripePort } from '../ports/stripe.port';

@Injectable()
export class UsageTrackerService {
  private readonly usage: Map<string, Map<string, number>> = new Map();

  constructor(
    @Inject(STRIPE_PORT) private readonly stripePort: StripePort,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UsageTrackerService.name);
  }

  async recordUsage(
    companyId: string,
    featureKey: string,
    quantity: number,
  ): Promise<void> {
    let companyMap = this.usage.get(companyId);
    if (!companyMap) {
      companyMap = new Map();
      this.usage.set(companyId, companyMap);
    }
    const current = companyMap.get(featureKey) ?? 0;
    companyMap.set(featureKey, current + quantity);
    return Promise.resolve();
  }

  async flushDailyUsage(): Promise<void> {
    if (this.usage.size === 0) return;

    for (const [companyId, features] of this.usage.entries()) {
      for (const [featureKey, value] of features.entries()) {
        try {
          await this.stripePort.createUsageRecord({
            customerId: companyId,
            meterEventName: featureKey,
            value,
          });
        } catch (err) {
          this.logger.error(
            { companyId, featureKey, value, err },
            'Failed to flush usage record',
          );
        }
      }
    }

    this.usage.clear();
  }
}
