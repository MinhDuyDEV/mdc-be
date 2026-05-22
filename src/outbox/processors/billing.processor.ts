import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class BillingProcessor {
  private readonly logger = new Logger(BillingProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async processPaymentProviderEvent(eventId: string) {
    const event = await this.prisma.paymentProviderEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      this.logger.warn(`Event ${eventId} not found`);
      return;
    }

    if (event.processedAt) {
      this.logger.debug(`Event ${eventId} already processed`);
      return;
    }

    const payload = event.payload as Record<string, unknown>;
    let handled = false;

    switch (event.eventType) {
      case 'invoice.paid':
        handled = await this.handleInvoicePaid(event.id, payload);
        break;
      case 'customer.subscription.updated':
        handled = await this.handleSubscriptionUpdated(event.id, payload);
        break;
      case 'customer.subscription.deleted':
        handled = await this.handleSubscriptionDeleted(event.id, payload);
        break;
      default:
        this.logger.warn(`Unhandled event type: ${event.eventType}`);
        return; // Don't mark as processed for unknown event types — outbox will retry/dead-letter
    }

    // Only mark as processed if the handler actually processed the event
    if (handled) {
      await this.prisma.paymentProviderEvent.update({
        where: { id: eventId },
        data: { processedAt: new Date() },
      });
    }
  }

  private async handleInvoicePaid(
    eventId: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    const data = (payload as { data?: { object?: Record<string, unknown> } })
      .data;
    const obj = data?.object;
    const providerInvoiceId = obj?.id as string | undefined;
    const subscriptionId = obj?.subscription as string | undefined;

    if (!providerInvoiceId) return false;

    const subscription = await this.prisma.subscription.findFirst({
      where: { providerSubscriptionId: subscriptionId },
    });

    if (!subscription) {
      this.logger.warn(
        `Subscription not found for provider ID: ${subscriptionId}`,
      );
      return false;
    }

    await this.prisma.invoice.upsert({
      where: { providerInvoiceId },
      create: {
        subscriptionId: subscription.id,
        companyId: subscription.companyId,
        status: 'paid',
        amountDue: (obj?.amount_due as number) ?? 0,
        amountPaid: (obj?.amount_paid as number) ?? 0,
        currency: (obj?.currency as string) ?? 'usd',
        periodStart: new Date(((obj?.period_start as number) ?? 0) * 1000),
        periodEnd: new Date(((obj?.period_end as number) ?? 0) * 1000),
        paidAt: new Date(),
        providerInvoiceId,
        providerInvoiceUrl: obj?.hosted_invoice_url as string,
      },
      update: {
        status: 'paid',
        amountPaid: (obj?.amount_paid as number) ?? 0,
        paidAt: new Date(),
      },
    });

    return true;
  }

  private async handleSubscriptionUpdated(
    eventId: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    const data = (payload as { data?: { object?: Record<string, unknown> } })
      .data;
    const obj = data?.object;
    const providerSubscriptionId = obj?.id as string | undefined;
    const status = obj?.status as string | undefined;

    if (!providerSubscriptionId) return false;

    const result = await this.prisma.subscription.updateMany({
      where: { providerSubscriptionId },
      data: {
        status: status ?? 'active',
        currentPeriodStart: new Date(
          ((obj?.current_period_start as number) ?? 0) * 1000,
        ),
        currentPeriodEnd: new Date(
          ((obj?.current_period_end as number) ?? 0) * 1000,
        ),
      },
    });

    if (result.count === 0) {
      this.logger.warn(
        `Subscription not found for provider ID: ${providerSubscriptionId}`,
      );
      return false;
    }

    return true;
  }

  private async handleSubscriptionDeleted(
    eventId: string,
    payload: Record<string, unknown>,
  ): Promise<boolean> {
    const data = (payload as { data?: { object?: Record<string, unknown> } })
      .data;
    const obj = data?.object;
    const providerSubscriptionId = obj?.id as string | undefined;

    if (!providerSubscriptionId) return false;

    await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.subscription.findFirst({
        where: { providerSubscriptionId },
      });

      if (!subscription) return;

      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: 'canceled', canceledAt: new Date() },
      });

      // Revoke entitlements
      await tx.entitlementGrant.updateMany({
        where: { subscriptionId: subscription.id, revokedAt: null },
        data: { revokedAt: new Date(), validUntil: new Date() },
      });

      // Update CompanyEntitlement materialized view
      await tx.companyEntitlement.updateMany({
        where: { companyId: subscription.companyId },
        data: {
          creditsRemaining: 0,
          validUntil: new Date(),
        },
      });
    });

    return true;
  }
}
