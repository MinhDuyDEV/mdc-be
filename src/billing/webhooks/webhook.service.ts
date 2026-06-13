import * as crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../infra/config';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { IdempotencyService } from '../../outbox/idempotency.service';
import { OutboxService } from '../../outbox/outbox.service';

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly idempotencyService: IdempotencyService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  verifySignature(
    payload: string,
    signature: string,
    timestamp: string,
  ): boolean {
    const secret = this.configService.get('billingWebhookSecret', {
      infer: true,
    });
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  async processWebhook(
    provider: string,
    eventId: string,
    eventType: string,
    payload: unknown,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Idempotency check inside transaction — if claim fails, rollback
      const idempotencyKey = `${provider}:${eventId}`;
      try {
        await this.idempotencyService.claim(tx, 'WebhookEvent', idempotencyKey);
      } catch {
        // Already processed
        return { processed: false, reason: 'duplicate' };
      }
      const event = await tx.paymentProviderEvent.create({
        data: {
          provider,
          providerEventId: eventId,
          eventType,
          payload: payload as object,
        },
      });

      await this.outboxService.emit(tx, {
        eventType: 'PaymentProviderEventReceived',
        aggregateType: 'PaymentProviderEvent',
        aggregateId: event.id,
        payload: { eventId: event.id, provider, eventType },
      });

      return { processed: true, eventId: event.id };
    });
  }

  async processStripeWebhook(event: {
    type: string;
    data: { object: unknown };
    id: string;
  }): Promise<{ processed: boolean; reason?: string }> {
    // Layer 2 idempotency via WebhookEvent table
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });
    if (existing?.processedAt) {
      return { processed: false, reason: 'duplicate' };
    }

    // Upsert webhook event tracking
    await this.prisma.webhookEvent.upsert({
      where: { stripeEventId: event.id },
      create: {
        provider: 'stripe',
        stripeEventId: event.id,
        eventType: event.type,
      },
      update: {},
    });

    // Route to existing webhook processing pipeline
    const result = await this.processWebhook('stripe', event.id, event.type, {
      data: event.data,
      type: event.type,
    });

    // Mark as processed
    if (result.processed) {
      await this.prisma.webhookEvent.update({
        where: { stripeEventId: event.id },
        data: { processedAt: new Date() },
      });
    }

    return result;
  }
}
