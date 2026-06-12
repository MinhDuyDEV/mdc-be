import { Injectable } from '@nestjs/common';
import { OutboxService } from '../outbox/outbox.service';
import { PrismaService } from '../infra/prisma';
import type { PrismaTransaction } from '../infra/prisma';

export interface TrackEventParams {
  experimentId: string;
  userId: string;
  variant: string;
}

@Injectable()
export class ExperimentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async trackEvent(params: TrackEventParams): Promise<void> {
    const { experimentId, userId, variant } = params;

    await this.prisma.$transaction(async (tx: PrismaTransaction) => {
      await this.outbox.emit(tx, {
        eventType: 'ExperimentImpression',
        aggregateType: 'ExperimentImpression',
        aggregateId: `${experimentId}:${userId}`,
        payload: {
          experimentId,
          userId,
          variant,
          timestamp: new Date().toISOString(),
        },
      });
    });
  }
}
