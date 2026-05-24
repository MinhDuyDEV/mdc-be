import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, type PrismaTransaction } from '../infra/prisma';
import { validateOutboxPayload } from './events';

export interface DeadLetterEvent {
  id: string;
  eventType: string;
  payload: Prisma.JsonValue;
}

function toInputJsonValue(
  value: Prisma.JsonValue,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : value;
}

@Injectable()
export class DeadLetterService {
  constructor(private readonly prisma: PrismaService) {}

  async moveToDeadLetter(event: DeadLetterEvent, error: Error): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.outboxDeadLetter.create({
        data: {
          outboxEventId: event.id,
          eventType: event.eventType,
          payload: toInputJsonValue(event.payload),
          reason: error.message,
        },
      });

      await tx.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: 'FAILED',
          lockedAt: null,
          lockedBy: null,
        },
      });
    });
  }

  async replay(deadLetterId: string): Promise<void>;
  async replay(tx: PrismaTransaction, deadLetterId: string): Promise<void>;
  async replay(
    txOrDeadLetterId: PrismaTransaction | string,
    maybeDeadLetterId?: string,
  ): Promise<void> {
    if (typeof txOrDeadLetterId !== 'string') {
      if (!maybeDeadLetterId) {
        throw new Error('Dead letter id is required');
      }
      await this.replayWithClient(txOrDeadLetterId, maybeDeadLetterId);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.replayWithClient(tx, txOrDeadLetterId);
    });
  }

  private async replayWithClient(
    tx: PrismaTransaction,
    deadLetterId: string,
  ): Promise<void> {
    const deadLetter = await tx.outboxDeadLetter.findUnique({
      where: { id: deadLetterId },
    });

    if (!deadLetter) {
      throw new Error(`Dead letter event not found: ${deadLetterId}`);
    }

    const payload = validateOutboxPayload(
      deadLetter.eventType,
      deadLetter.payload,
    );

    // Create a new PENDING event from the dead-letter payload
    await tx.outboxEvent.create({
      data: {
        eventType: deadLetter.eventType,
        payload,
        status: 'PENDING',
      },
    });

    // Remove the dead-letter record
    await tx.outboxDeadLetter.delete({
      where: { id: deadLetterId },
    });
  }
}
