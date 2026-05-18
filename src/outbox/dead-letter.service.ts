import { Injectable } from '@nestjs/common';
import type { PrismaService } from '../infra/prisma';

export interface DeadLetterEvent {
  id: string;
  eventType: string;
  payload: unknown;
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
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          payload: event.payload as any,
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

  async replay(deadLetterId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const deadLetter = await tx.outboxDeadLetter.findUnique({
        where: { id: deadLetterId },
      });

      if (!deadLetter) {
        throw new Error(`Dead letter event not found: ${deadLetterId}`);
      }

      // Create a new PENDING event from the dead-letter payload
      await tx.outboxEvent.create({
        data: {
          eventType: deadLetter.eventType,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          payload: deadLetter.payload as any,
          status: 'PENDING',
        },
      });

      // Remove the dead-letter record
      await tx.outboxDeadLetter.delete({
        where: { id: deadLetterId },
      });
    });
  }
}
