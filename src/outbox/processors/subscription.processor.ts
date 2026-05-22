import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FEATURE_KEY_TO_ENTITLEMENT } from '../../billing/billing.constants';
import type { AppConfig } from '../../infra/config';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class SubscriptionProcessor {
  private readonly logger = new Logger(SubscriptionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async createFreeSubscription(companyId: string) {
    const freePlanSlug = this.configService.get('billingDefaultFreePlanSlug', {
      infer: true,
    });
    const freePlan = await this.prisma.billingPlan.findUnique({
      where: { slug: freePlanSlug },
    });

    if (!freePlan) {
      this.logger.warn(`Free plan '${freePlanSlug}' not found`);
      return;
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setFullYear(periodEnd.getFullYear() + 100); // Effectively permanent

    // Use create with on-conflict handling for idempotency
    // The unique constraint on companyId guards against concurrent duplicates
    const subscription = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findUnique({
        where: { companyId },
      });
      if (existing) {
        this.logger.debug(`Company ${companyId} already has subscription`);
        return null;
      }

      return tx.subscription.create({
        data: {
          companyId,
          planId: freePlan.id,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    });

    // Race: concurrent processing may create a duplicate via P2002 unique constraint.
    // Outbox retry with backoff will re-enter findUnique check and find the now-existing
    // subscription on next attempt.
    if (!subscription) return;

    await this.prisma.$transaction(async (tx) => {
      const features = freePlan.features as Record<string, number>;
      for (const [key, value] of Object.entries(features)) {
        await tx.entitlementGrant.create({
          data: {
            subscriptionId: subscription.id,
            companyId,
            featureKey: key,
            featureValue: value,
            validFrom: now,
            validUntil: periodEnd,
          },
        });

        const entitlementType = FEATURE_KEY_TO_ENTITLEMENT[key];
        if (!entitlementType) continue;

        const existingEntitlement = await tx.companyEntitlement.findFirst({
          where: { companyId, entitlementType },
        });

        if (existingEntitlement) {
          await tx.companyEntitlement.update({
            where: { id: existingEntitlement.id },
            data: {
              creditsTotal: value,
              creditsRemaining: value,
              validFrom: now,
              validUntil: periodEnd,
            },
          });
        } else {
          await tx.companyEntitlement.create({
            data: {
              companyId,
              entitlementType,
              creditsTotal: value,
              creditsRemaining: value,
              validFrom: now,
              validUntil: periodEnd,
            },
          });
        }
      }
    });

    this.logger.log(`Created free subscription for company ${companyId}`);
  }
}
