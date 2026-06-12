import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface ExperimentImpressionPayload {
  experimentId: string;
  userId: string;
  variant: string;
  timestamp: string;
}

@Injectable()
export class ExperimentTrackingProcessor {
  private readonly logger = new Logger(ExperimentTrackingProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async process(payload: ExperimentImpressionPayload): Promise<void> {
    try {
      await this.prisma.experimentImpression.create({
        data: {
          experimentId: payload.experimentId,
          userId: payload.userId,
          variant: payload.variant,
          impressedAt: new Date(payload.timestamp),
        },
      });
    } catch (err: unknown) {
      // Prisma P2002 = unique constraint violation — idempotent, safe to ignore
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        this.logger.debug(
          `Duplicate experiment impression (${payload.experimentId}, ${payload.userId}) — ignoring`,
        );
        return;
      }
      throw err;
    }
  }
}
