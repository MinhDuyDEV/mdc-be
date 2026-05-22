import * as crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../infra/config';
import {
  PrismaService,
  type PrismaTransaction,
} from '../../infra/prisma/prisma.service';
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
    // Idempotency check
    const idempotencyKey = `${provider}:${eventId}`;
    try {
      await this.idempotencyService.claim('WebhookEvent', idempotencyKey);
    } catch {
      // Already processed
      return { processed: false, reason: 'duplicate' };
    }

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.paymentProviderEvent.create({
        data: {
          provider,
          providerEventId: eventId,
          eventType,
          payload: payload as object,
        },
      });

      await this.outboxService.emit(tx as PrismaTransaction, {
        eventType: 'PaymentProviderEventReceived',
        aggregateType: 'PaymentProviderEvent',
        aggregateId: event.id,
        payload: { eventId: event.id, provider, eventType },
      });

      return { processed: true, eventId: event.id };
    });
  }
}
