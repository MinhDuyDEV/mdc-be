/* eslint-disable @typescript-eslint/no-unused-vars */
import { Injectable } from '@nestjs/common';
import type {
  StripePaymentMethodDetails,
  StripePort,
} from '../ports/stripe.port';

@Injectable()
export class MockStripeService implements StripePort {
  private readonly customers: Map<
    string,
    { id: string; email: string; name?: string }
  > = new Map();
  private readonly paymentMethods: Map<string, StripePaymentMethodDetails> =
    new Map();
  private readonly subscriptions: Map<
    string,
    {
      id: string;
      status: string;
      currentPeriodEnd: number;
      metadata: Record<string, string>;
    }
  > = new Map();

  createCustomer(input: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<{ id: string }> {
    const id = `mock_cus_${this.customers.size + 1}`;
    this.customers.set(id, { id, email: input.email, name: input.name });
    return Promise.resolve({ id });
  }

  createSetupIntent(_customerId: string): Promise<{ clientSecret: string }> {
    return Promise.resolve({ clientSecret: 'seti_secret_mock' });
  }

  attachPaymentMethod(
    _customerId: string,
    paymentMethodId: string,
  ): Promise<StripePaymentMethodDetails> {
    const details: StripePaymentMethodDetails = {
      id: paymentMethodId,
      type: 'card',
      card: { last4: '4242', brand: 'visa', expMonth: 12, expYear: 2030 },
    };
    this.paymentMethods.set(paymentMethodId, details);
    return Promise.resolve(details);
  }

  detachPaymentMethod(paymentMethodId: string): Promise<void> {
    this.paymentMethods.delete(paymentMethodId);
    return Promise.resolve();
  }

  setDefaultPaymentMethod(
    _customerId: string,
    _paymentMethodId: string,
  ): Promise<void> {
    return Promise.resolve();
  }

  listPaymentMethods(
    _customerId: string,
  ): Promise<StripePaymentMethodDetails[]> {
    return Promise.resolve([...this.paymentMethods.values()]);
  }

  createSubscription(input: {
    customerId: string;
    priceId: string;
    paymentMethodId: string;
    metadata?: Record<string, string>;
    trialDays?: number;
  }): Promise<{
    id: string;
    status: string;
    currentPeriodEnd: number;
    metadata: Record<string, string>;
  }> {
    const id = `mock_sub_${this.subscriptions.size + 1}`;
    const now = Date.now();
    const sub = {
      id,
      status: input.trialDays ? 'trialing' : 'active',
      currentPeriodEnd: now + 30 * 24 * 3600 * 1000,
      metadata: input.metadata ?? {},
    };
    this.subscriptions.set(id, sub);
    return Promise.resolve(sub);
  }

  updateSubscription(input: {
    subscriptionId: string;
    priceId?: string;
    prorationBehavior?: 'create_prorations' | 'always_invoice' | 'none';
    cancelAtPeriodEnd?: boolean;
  }): Promise<{ id: string; status: string; currentPeriodEnd: number }> {
    const existing = this.subscriptions.get(input.subscriptionId);
    const sub = existing ?? {
      id: input.subscriptionId,
      status: 'active',
      currentPeriodEnd: Date.now() + 30 * 24 * 3600 * 1000,
    };
    return Promise.resolve({
      id: sub.id,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
    });
  }

  cancelSubscription(
    subscriptionId: string,
    atPeriodEnd: boolean,
  ): Promise<{ id: string; status: string }> {
    const sub = this.subscriptions.get(subscriptionId);
    const result = sub ?? { id: subscriptionId, status: 'active' };
    result.status = atPeriodEnd ? 'active' : 'canceled';
    return Promise.resolve({ id: result.id, status: result.status });
  }

  getSubscription(subscriptionId: string): Promise<{
    id: string;
    status: string;
    currentPeriodEnd: number;
    metadata: Record<string, string>;
  }> {
    const sub = this.subscriptions.get(subscriptionId);
    return Promise.resolve(
      sub ?? {
        id: subscriptionId,
        status: 'active',
        currentPeriodEnd: Date.now() + 30 * 24 * 3600 * 1000,
        metadata: {},
      },
    );
  }

  previewProration(_input: {
    customerId: string;
    subscriptionId: string;
    newPriceId: string;
    prorationDate?: number;
  }): Promise<{
    amountDue: number;
    currency: string;
    lineItems: Array<{ description: string; amount: number }>;
  }> {
    return Promise.resolve({
      amountDue: 0,
      currency: 'usd',
      lineItems: [{ description: 'Proration preview', amount: 0 }],
    });
  }

  createUsageRecord(_input: {
    customerId: string;
    meterEventName: string;
    value: number;
    timestamp?: number;
  }): Promise<{ id: string }> {
    return Promise.resolve({ id: `mock_ur_${Date.now()}` });
  }

  constructWebhookEvent(
    _payload: string | Buffer,
    _signature: string,
  ): { type: string; data: { object: unknown }; id: string } {
    return {
      type: 'mock.event',
      data: { object: {} },
      id: `mock_evt_${Date.now()}`,
    };
  }
}
