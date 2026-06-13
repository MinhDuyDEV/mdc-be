import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../outbox/idempotency.service';
import { OutboxService } from '../../outbox/outbox.service';
import { STRIPE_PORT, type StripePort } from '../ports/stripe.port';

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

  async upgrade(companyId: string, newPlanId: string, idempotencyKey: string) {
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

    await this.stripePort.updateSubscription({
      subscriptionId: sub.providerSubscriptionId,
      priceId: newPlanId,
      prorationBehavior: 'always_invoice',
    });

    const updated = await this.prisma.subscription.update({
      where: { companyId },
      data: { planId: newPlanId },
    });

    await this.outboxService.emit(this.prisma, {
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
  }

  async downgrade(
    companyId: string,
    newPlanId: string,
    idempotencyKey: string,
  ) {
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

    await this.stripePort.updateSubscription({
      subscriptionId: sub.providerSubscriptionId,
      prorationBehavior: 'none',
      cancelAtPeriodEnd: true,
    });

    const updated = await this.prisma.subscription.update({
      where: { companyId },
      data: { scheduledPlanId: newPlanId, cancelAtPeriodEnd: true },
    });

    await this.outboxService.emit(this.prisma, {
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
  }

  async processPeriodEnd(subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub || !sub.scheduledPlanId) return;

    const oldPlanId = sub.planId;

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        planId: sub.scheduledPlanId,
        scheduledPlanId: null,
        cancelAtPeriodEnd: false,
      },
    });

    await this.outboxService.emit(this.prisma, {
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
  }

  private async getSubscriptionOrThrow(companyId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { companyId },
    });
    if (!sub) throw new NotFoundException('SUBSCRIPTION_NOT_FOUND');
    return sub;
  }
}
