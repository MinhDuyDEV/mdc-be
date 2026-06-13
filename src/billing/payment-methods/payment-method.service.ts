import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { OutboxService } from '../../outbox/outbox.service';
import { STRIPE_PORT, type StripePort } from '../ports/stripe.port';

@Injectable()
export class PaymentMethodService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STRIPE_PORT) private readonly stripePort: StripePort,
    private readonly outboxService: OutboxService,
  ) {}

  async createSetupIntent(companyId: string) {
    // Get or create Stripe customer
    const sub = await this.prisma.subscription.findUnique({
      where: { companyId },
    });

    let providerCustomerId = sub?.providerCustomerId;

    if (!providerCustomerId) {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
      });
      const customer = await this.stripePort.createCustomer({
        email: `${companyId}@mdc.local`,
        name: company?.name ?? undefined,
      });
      providerCustomerId = customer.id;
      if (sub) {
        await this.prisma.subscription.update({
          where: { companyId },
          data: { providerCustomerId },
        });
      }
    }

    const intent = await this.stripePort.createSetupIntent(providerCustomerId);
    return { clientSecret: intent.clientSecret };
  }

  async attachPaymentMethod(companyId: string, providerMethodId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { companyId },
    });
    if (!sub?.providerCustomerId) {
      throw new NotFoundException('CUSTOMER_NOT_FOUND');
    }

    const details = await this.stripePort.attachPaymentMethod(
      sub.providerCustomerId,
      providerMethodId,
    );

    const pm = await this.prisma.paymentMethod.create({
      data: {
        companyId,
        provider: 'stripe',
        providerMethodId: details.id,
        type: details.type,
        last4: details.card?.last4 ?? null,
        brand: details.card?.brand ?? null,
        expMonth: details.card?.expMonth ?? null,
        expYear: details.card?.expYear ?? null,
      },
    });

    await this.outboxService.emit(this.prisma, {
      eventType: 'PaymentMethodAdded',
      aggregateType: 'PaymentMethod',
      aggregateId: pm.id,
      payload: {
        paymentMethodId: pm.id,
        companyId,
        type: pm.type,
        isDefault: pm.isDefault,
      },
    });

    return pm;
  }

  async listPaymentMethods(companyId: string) {
    return this.prisma.paymentMethod.findMany({
      where: { companyId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setDefault(companyId: string, paymentMethodId: string) {
    const pm = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, companyId },
    });
    if (!pm) throw new NotFoundException('PAYMENT_METHOD_NOT_FOUND');

    // Unset existing defaults
    await this.prisma.paymentMethod.updateMany({
      where: { companyId, isDefault: true },
      data: { isDefault: false },
    });

    const updated = await this.prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: true },
    });

    const sub = await this.prisma.subscription.findUnique({
      where: { companyId },
    });
    if (sub?.providerCustomerId) {
      await this.stripePort.setDefaultPaymentMethod(
        sub.providerCustomerId,
        pm.providerMethodId,
      );
    }

    await this.outboxService.emit(this.prisma, {
      eventType: 'PaymentMethodAdded',
      aggregateType: 'PaymentMethod',
      aggregateId: updated.id,
      payload: {
        paymentMethodId: updated.id,
        companyId,
        type: updated.type,
        isDefault: true,
      },
    });

    return updated;
  }

  async removePaymentMethod(companyId: string, paymentMethodId: string) {
    const pm = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, companyId },
    });
    if (!pm) throw new NotFoundException('PAYMENT_METHOD_NOT_FOUND');

    await this.stripePort.detachPaymentMethod(pm.providerMethodId);

    const updated = await this.prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { status: 'revoked' },
    });

    await this.outboxService.emit(this.prisma, {
      eventType: 'PaymentMethodRemoved',
      aggregateType: 'PaymentMethod',
      aggregateId: updated.id,
      payload: {
        paymentMethodId: updated.id,
        companyId,
      },
    });

    return updated;
  }
}
