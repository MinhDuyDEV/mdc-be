import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { OutboxCoreModule } from '../outbox/outbox-core.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { EntitlementsGuard } from './entitlements/entitlements.guard';
import { EntitlementsService } from './entitlements/entitlements.service';
import { PaymentMethodController } from './payment-methods/payment-method.controller';
import { PaymentMethodService } from './payment-methods/payment-method.service';
import { StripeProrationService } from './proration/stripe-proration.service';
import { StripeModule } from './stripe/stripe.module';
import { BillingUsageFlushService } from './usage/billing-usage-flush.service';
import { UsageThresholdService } from './usage/usage-threshold.service';
import { UsageTrackerService } from './usage/usage-tracker.service';
import { WebhookController } from './webhooks/webhook.controller';
import { WebhookService } from './webhooks/webhook.service';
import { WebhookSignatureGuard } from './webhooks/webhook-signature.guard';

@Module({
  imports: [InfraModule, OutboxCoreModule, StripeModule],
  controllers: [BillingController, WebhookController, PaymentMethodController],
  providers: [
    BillingService,
    BillingUsageFlushService,
    EntitlementsService,
    EntitlementsGuard,
    PaymentMethodService,
    StripeProrationService,
    UsageThresholdService,
    UsageTrackerService,
    WebhookService,
    WebhookSignatureGuard,
  ],
  exports: [BillingService, EntitlementsService, StripeModule],
})
export class BillingModule {}
