import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { AppConfig } from '../../infra/config';
import type {
  StripePaymentMethodDetails,
  StripePort,
} from '../ports/stripe.port';

@Injectable()
export class StripeService implements StripePort, OnModuleInit {
  private stripe!: Stripe;

  constructor(
    @Inject(ConfigService)
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  onModuleInit(): void {
    const secretKey = this.configService.get('stripeSecretKey', {
      infer: true,
    });
    const apiVersion = this.configService.get('stripeApiVersion', {
      infer: true,
    });
    this.stripe = new Stripe(secretKey, { apiVersion } as Stripe.StripeConfig);
  }

  async createCustomer(input: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<{ id: string }> {
    const customer = await this.stripe.customers.create({
      email: input.email,
      name: input.name,
      metadata: input.metadata,
    });
    return { id: customer.id };
  }

  async createSetupIntent(
    customerId: string,
  ): Promise<{ clientSecret: string }> {
    const intent = await this.stripe.setupIntents.create({
      customer: customerId,
    });
    return { clientSecret: intent.client_secret ?? '' };
  }

  async attachPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<StripePaymentMethodDetails> {
    const pm = await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    return this.toPaymentMethodDetails(pm);
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    await this.stripe.paymentMethods.detach(paymentMethodId);
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<void> {
    await this.stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  async listPaymentMethods(
    customerId: string,
  ): Promise<StripePaymentMethodDetails[]> {
    const pms = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return pms.data.map((pm) => this.toPaymentMethodDetails(pm));
  }

  async createSubscription(input: {
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
    const sub = await this.stripe.subscriptions.create({
      customer: input.customerId,
      items: [{ price: input.priceId }],
      default_payment_method: input.paymentMethodId,
      metadata: input.metadata,
      trial_period_days: input.trialDays,
      proration_behavior: 'create_prorations',
    });
    return {
      id: sub.id,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      metadata: sub.metadata,
    };
  }

  async updateSubscription(input: {
    subscriptionId: string;
    priceId?: string;
    prorationBehavior?: 'create_prorations' | 'always_invoice' | 'none';
    cancelAtPeriodEnd?: boolean;
  }): Promise<{ id: string; status: string; currentPeriodEnd: number }> {
    const updateParams: Stripe.SubscriptionUpdateParams = {};
    if (input.priceId) {
      updateParams.items = [{ price: input.priceId }];
    }
    if (input.cancelAtPeriodEnd !== undefined) {
      updateParams.cancel_at_period_end = input.cancelAtPeriodEnd;
    }
    if (input.prorationBehavior) {
      updateParams.proration_behavior = input.prorationBehavior;
    }
    const sub = await this.stripe.subscriptions.update(
      input.subscriptionId,
      updateParams,
    );
    return {
      id: sub.id,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
    };
  }

  async cancelSubscription(
    subscriptionId: string,
    atPeriodEnd: boolean,
  ): Promise<{ id: string; status: string }> {
    const sub = atPeriodEnd
      ? await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        })
      : await this.stripe.subscriptions.cancel(subscriptionId);
    return { id: sub.id, status: sub.status };
  }

  async getSubscription(subscriptionId: string): Promise<{
    id: string;
    status: string;
    currentPeriodEnd: number;
    metadata: Record<string, string>;
  }> {
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
    return {
      id: sub.id,
      status: sub.status,
      currentPeriodEnd: sub.current_period_end,
      metadata: sub.metadata,
    };
  }

  async previewProration(input: {
    customerId: string;
    subscriptionId: string;
    newPriceId: string;
    prorationDate?: number;
  }): Promise<{
    amountDue: number;
    currency: string;
    lineItems: Array<{ description: string; amount: number }>;
  }> {
    const invoice = await this.stripe.invoices.retrieveUpcoming({
      customer: input.customerId,
      subscription: input.subscriptionId,
      subscription_items: [{ price: input.newPriceId }],
      subscription_proration_date: input.prorationDate,
    });
    return {
      amountDue: invoice.amount_due,
      currency: invoice.currency,
      lineItems: invoice.lines.data.map((line: Stripe.InvoiceLineItem) => ({
        description: line.description ?? '',
        amount: line.amount,
      })),
    };
  }

  async createUsageRecord(input: {
    customerId: string;
    meterEventName: string;
    value: number;
    timestamp?: number;
  }): Promise<{ id: string }> {
    // Use the Stripe Meter Events API (v2 billing). The port's
    // meterEventName + customerId fields map directly to
    // event_name + stripe_customer_id in the payload.
    // NOTE: caller MUST pass a Stripe customer ID (cus_xxx), not a
    // DB company UUID, as customerId.
    // The Stripe Meter Events API is not yet surfaced in the public
    // TypeScript types for the SDK we depend on, so we narrow the
    // surface to just the method we need.
    type MeterEventCreateParams = {
      event_name: string;
      payload: Record<string, string>;
    };
    type MeterEventRecord = { id: string };
    const meterEvents = (
      this.stripe as unknown as {
        meterEvents: {
          create: (params: MeterEventCreateParams) => Promise<MeterEventRecord>;
        };
      }
    ).meterEvents;
    const record = await meterEvents.create({
      event_name: input.meterEventName,
      payload: {
        value: String(input.value),
        stripe_customer_id: input.customerId,
        // timestamp is not needed by the Meter Events API — Stripe
        // records the event time server-side. The input field is
        // retained in the port for forward compatibility.
      },
    });
    return { id: record.id };
  }

  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
  ): { type: string; data: { object: unknown }; id: string } {
    const secret = this.configService.get('stripeWebhookSecret', {
      infer: true,
    });
    const event = this.stripe.webhooks.constructEvent(
      payload,
      signature,
      secret,
    );
    return {
      type: event.type,
      data: { object: event.data.object },
      id: event.id,
    };
  }

  private toPaymentMethodDetails(
    pm: Stripe.PaymentMethod,
  ): StripePaymentMethodDetails {
    const result: StripePaymentMethodDetails = {
      id: pm.id,
      type: pm.type,
    };
    const card = pm.card;
    if (card) {
      result.card = {
        last4: card.last4,
        brand: card.brand,
        expMonth: card.exp_month,
        expYear: card.exp_year,
      };
    }
    return result;
  }
}
