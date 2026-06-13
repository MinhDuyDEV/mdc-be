export const STRIPE_PORT = Symbol('STRIPE_PORT');

export interface StripePaymentMethodDetails {
  id: string;
  type: string;
  card?: { last4: string; brand: string; expMonth: number; expYear: number };
}

export interface StripePort {
  createCustomer(input: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }): Promise<{ id: string }>;

  createSetupIntent(customerId: string): Promise<{ clientSecret: string }>;

  attachPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<StripePaymentMethodDetails>;

  detachPaymentMethod(paymentMethodId: string): Promise<void>;

  setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<void>;

  listPaymentMethods(customerId: string): Promise<StripePaymentMethodDetails[]>;

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
  }>;

  updateSubscription(input: {
    subscriptionId: string;
    priceId?: string;
    prorationBehavior?: 'create_prorations' | 'always_invoice' | 'none';
    cancelAtPeriodEnd?: boolean;
  }): Promise<{ id: string; status: string; currentPeriodEnd: number }>;

  cancelSubscription(
    subscriptionId: string,
    atPeriodEnd: boolean,
  ): Promise<{ id: string; status: string }>;

  getSubscription(subscriptionId: string): Promise<{
    id: string;
    status: string;
    currentPeriodEnd: number;
    metadata: Record<string, string>;
  }>;

  previewProration(input: {
    customerId: string;
    subscriptionId: string;
    newPriceId: string;
    prorationDate?: number;
  }): Promise<{
    amountDue: number;
    currency: string;
    lineItems: Array<{ description: string; amount: number }>;
  }>;

  createUsageRecord(input: {
    customerId: string;
    meterEventName: string;
    value: number;
    timestamp?: number;
  }): Promise<{ id: string }>;

  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
  ): { type: string; data: { object: unknown }; id: string };
}
