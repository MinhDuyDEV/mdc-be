import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { OutboxModule } from '../outbox';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { EntitlementsGuard } from './entitlements/entitlements.guard';
import { EntitlementsService } from './entitlements/entitlements.service';
import { WebhookController } from './webhooks/webhook.controller';
import { WebhookService } from './webhooks/webhook.service';
import { WebhookSignatureGuard } from './webhooks/webhook-signature.guard';

@Module({
  imports: [InfraModule, OutboxModule],
  controllers: [BillingController, WebhookController],
  providers: [
    BillingService,
    EntitlementsService,
    EntitlementsGuard,
    WebhookService,
    WebhookSignatureGuard,
  ],
  exports: [BillingService, EntitlementsService],
})
export class BillingModule {}
