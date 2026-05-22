import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../infra/config';
import type { PrismaService } from '../../infra/prisma/prisma.service';

const FEATURE_KEY_TO_ENTITLEMENT: Record<string, string> = {
  max_jobs: 'job_posts',
  max_members: 'recruiter_seats',
  max_recruiter_seats: 'recruiter_seats',
};

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

    // Use upsert for idempotency under concurrent processing
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.subscription.findUnique({
        where: { companyId },
      });
      if (existing) {
        this.logger.debug(`Company ${companyId} already has subscription`);
        return;
      }

      const subscription = await tx.subscription.create({
        data: {
          companyId,
          planId: freePlan.id,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });

      // Create entitlement grants and materialized view
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
