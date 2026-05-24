import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaTransaction } from '../infra/prisma';
import { type OutboxEventType, validateOutboxPayload } from './events';

export interface OutboxEventInput {
  eventType: OutboxEventType;
  aggregateType?: string;
  aggregateId?: string;
  payload: Prisma.InputJsonValue;
}

@Injectable()
export class OutboxService {
  async emit(tx: PrismaTransaction, event: OutboxEventInput): Promise<void> {
    const payload = validateOutboxPayload(event.eventType, event.payload);
    await tx.outboxEvent.create({
      data: {
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload,
        status: 'PENDING',
        availableAt: new Date(),
      },
    });
  }
}
