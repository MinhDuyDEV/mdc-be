import { Module } from '@nestjs/common';
import { InfraModule } from '../infra';
import { OutboxCoreModule } from '../outbox/outbox-core.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { EntitlementsGuard } from './entitlements/entitlements.guard';
import { EntitlementsService } from './entitlements/entitlements.service';
import { WebhookController } from './webhooks/webhook.controller';
import { WebhookService } from './webhooks/webhook.service';
import { WebhookSignatureGuard } from './webhooks/webhook-signature.guard';

@Module({
  imports: [InfraModule, OutboxCoreModule],
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
