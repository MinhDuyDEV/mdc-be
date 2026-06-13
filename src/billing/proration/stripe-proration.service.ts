import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { PrismaTransaction } from '../../infra/prisma';
import { IdempotencyService } from '../../outbox/idempotency.service';
import { OutboxService } from '../../outbox/outbox.service';
import { STRIPE_PORT, type StripePort } from '../ports/stripe.port';
import type { ProrationBehavior } from '../dto/change-plan.dto';

@Injectable()
export class StripeProrationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STRIPE_PORT) private readonly stripePort: StripePort,
    private readonly outboxService: OutboxService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async previewChange(companyId: string, newPlanId: string) {
    const sub = await this.getSubscriptionOrThrow(companyId);
    if (!sub.providerSubscriptionId || !sub.providerCustomerId) {
      throw new NotFoundException('STRIPE_SUBSCRIPTION_NOT_FOUND');
    }
    const plan = await this.prisma.billingPlan.findUnique({
      where: { id: newPlanId },
    });
    if (!plan) throw new NotFoundException('PLAN_NOT_FOUND');

    return this.stripePort.previewProration({
      customerId: sub.providerCustomerId,
      subscriptionId: sub.providerSubscriptionId,
      newPriceId: newPlanId,
    });
  }

  async upgrade(
    companyId: string,
    newPlanId: string,
    idempotencyKey: string,
    prorationBehavior: ProrationBehavior = 'always_invoice',
  ) {
    // Idempotency claim outside the tx — it is the dedup mechanism, not a data write.
    await this.idempotencyService.claim('SubscriptionUpgrade', idempotencyKey);

    const sub = await this.getSubscriptionOrThrow(companyId);
    if (!sub.providerSubscriptionId) {
      throw new NotFoundException('STRIPE_SUBSCRIPTION_NOT_FOUND');
    }
    const plan = await this.prisma.billingPlan.findUnique({
      where: { id: newPlanId },
    });
    if (!plan) throw new NotFoundException('PLAN_NOT_FOUND');

    const oldPlanId = sub.planId;

    // Stripe API call before the transaction — external call, no local DB state.
    // If Stripe fails the error surfaces to the caller for retry.
    try {
      await this.stripePort.updateSubscription({
        subscriptionId: sub.providerSubscriptionId,
        priceId: newPlanId,
        prorationBehavior,
      });
    } catch (err) {
      throw new InternalServerErrorException(
        `Stripe subscription update failed: ${(err as Error).message}`,
      );
    }

    // DB update + outbox emit atomically inside the transaction.
    return this.prisma.$transaction(async (tx: PrismaTransaction) => {
      const updated = await tx.subscription.update({
        where: { companyId },
        data: { planId: newPlanId },
      });

      await this.outboxService.emit(tx, {
        eventType: 'SubscriptionUpgraded',
        aggregateType: 'Subscription',
        aggregateId: sub.id,
        payload: {
          subscriptionId: sub.id,
          companyId,
          fromPlanId: oldPlanId,
          toPlanId: newPlanId,
        },
      });

      return updated;
    });
  }

  async downgrade(
    companyId: string,
    newPlanId: string,
    idempotencyKey: string,
  ) {
    // Idempotency claim outside the tx — it is the dedup mechanism, not a data write.
    await this.idempotencyService.claim(
      'SubscriptionDowngrade',
      idempotencyKey,
    );

    const sub = await this.getSubscriptionOrThrow(companyId);
    if (!sub.providerSubscriptionId) {
      throw new NotFoundException('STRIPE_SUBSCRIPTION_NOT_FOUND');
    }
    const plan = await this.prisma.billingPlan.findUnique({
      where: { id: newPlanId },
    });
    if (!plan) throw new NotFoundException('PLAN_NOT_FOUND');

    const oldPlanId = sub.planId;

    // Stripe API call before the transaction — external call, no local DB state.
    try {
      await this.stripePort.updateSubscription({
        subscriptionId: sub.providerSubscriptionId,
        prorationBehavior: 'none',
        cancelAtPeriodEnd: true,
      });
    } catch (err) {
      throw new InternalServerErrorException(
        `Stripe subscription update failed: ${(err as Error).message}`,
      );
    }

    // DB update + outbox emit atomically inside the transaction.
    return this.prisma.$transaction(async (tx: PrismaTransaction) => {
      const updated = await tx.subscription.update({
        where: { companyId },
        data: { scheduledPlanId: newPlanId, cancelAtPeriodEnd: true },
      });

      await this.outboxService.emit(tx, {
        eventType: 'SubscriptionDowngraded',
        aggregateType: 'Subscription',
        aggregateId: sub.id,
        payload: {
          subscriptionId: sub.id,
          companyId,
          fromPlanId: oldPlanId,
          toPlanId: newPlanId,
          effectiveAt:
            sub.currentPeriodEnd?.toISOString() ?? new Date().toISOString(),
        },
      });

      return updated;
    });
  }

  async processPeriodEnd(subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub || !sub.scheduledPlanId) return;

    const oldPlanId = sub.planId;

    // DB update + outbox emit atomically inside the transaction.
    await this.prisma.$transaction(async (tx: PrismaTransaction) => {
      await tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          // scheduledPlanId is guaranteed non-null at this point
          // (method exits early when !scheduledPlanId).
          planId: sub.scheduledPlanId!,
          scheduledPlanId: null,
          cancelAtPeriodEnd: false,
        },
      });

      await this.outboxService.emit(tx, {
        eventType: 'SubscriptionDowngraded',
        aggregateType: 'Subscription',
        aggregateId: subscriptionId,
        payload: {
          subscriptionId: subscriptionId,
          companyId: sub.companyId,
          fromPlanId: oldPlanId,
          toPlanId: sub.scheduledPlanId,
          effectiveAt: new Date().toISOString(),
        },
      });
    });
  }

  private async getSubscriptionOrThrow(companyId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { companyId },
    });
    if (!sub) throw new NotFoundException('SUBSCRIPTION_NOT_FOUND');
    return sub;
  }
}
