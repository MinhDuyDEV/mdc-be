import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaTransaction } from '../infra/prisma';

export interface OutboxEventInput {
  eventType: string;
  aggregateType?: string;
  aggregateId?: string;
  payload: Prisma.InputJsonValue;
}

@Injectable()
export class OutboxService {
  async emit(tx: PrismaTransaction, event: OutboxEventInput): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!tx || typeof (tx as any).outboxEvent?.create !== 'function') {
      throw new Error(
        'OutboxService.emit must be called inside a Prisma transaction',
      );
    }

    await tx.outboxEvent.create({
      data: {
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        status: 'PENDING',
        availableAt: new Date(),
      },
    });
  }
}
