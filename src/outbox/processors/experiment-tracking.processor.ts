import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface ExperimentImpressionPayload {
  experimentId: string;
  userId: string;
  variant: string;
  timestamp: string;
}

/**
 * Append-only analytics: a returning user can be re-bucketed (no
 * `@@unique([experimentId, userId])` on the schema), so duplicate rows
 * are valid and the insert is intentionally unconditional. The outbox
 * processor is still idempotent at the dispatch level — the outbox
 * row's `status` transition is gated by SKIP LOCKED.
 */
@Injectable()
export class ExperimentTrackingProcessor {
  constructor(private readonly prisma: PrismaService) {}

  async process(payload: ExperimentImpressionPayload): Promise<void> {
    await this.prisma.experimentImpression.create({
      data: {
        experimentId: payload.experimentId,
        userId: payload.userId,
        variant: payload.variant,
        impressedAt: new Date(payload.timestamp),
      },
    });
  }
}
