import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import type { AppConfig } from '../infra/config';
import { PrismaService } from '../infra/prisma/prisma.service';
import { LeaderLockService } from '../infra/scheduling/leader-lock.service';
import { GdprService } from './gdpr.service';
import { DeletionRequestService } from './deletion-request.service';

/**
 * Polls DeletionRequest rows whose grace period (`scheduledFor`) has expired
 * and triggers `anonymizeUser` on each one. This is the only path in the
 * system that actually calls the anonymization orchestrator — without it,
 * GDPR/CCPA data subject rights are silently never enforced.
 *
 * Runs every 5 minutes, leader-locked (only one worker in a clustered
 * deployment will execute). Failures on one request are logged and do not
 * stop processing of the rest.
 */
@Injectable()
export class GdprGraceExpiryProcessor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly leaderLock: LeaderLockService,
    private readonly gdprService: GdprService,
    private readonly deletionRequestService: DeletionRequestService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'gdpr-grace-expiry',
    waitForCompletion: true,
  })
  async tick(): Promise<void> {
    const enabled = this.config.get('gdprGraceExpiryEnabled', { infer: true });
    if (!enabled) return;

    // 5 minute TTL is enough for the find + N anonymize calls in the loop.
    await this.leaderLock.runIfLeader(
      'gdpr-grace-expiry',
      300_000,
      async () => {
        const due =
          await this.deletionRequestService.findDueForAnonymization(50);
        for (const request of due) {
          await this.processOne(request.id);
        }
      },
    );
  }

  private async processOne(requestId: string): Promise<void> {
    try {
      // Transition PENDING_ERASURE -> IN_PROGRESS first. The FSM allows
      // PENDING_ERASURE -> IN_PROGRESS, and updateStatus is idempotent on
      // the final state (anonymizeUser will set COMPLETED inside the tx).
      await this.deletionRequestService
        .updateStatus(requestId, 'IN_PROGRESS')
        .catch((err: unknown) => {
          // FSM rejection (already IN_PROGRESS / CANCELLED) is not fatal —
          // a peer worker may have already picked it up.
          const httpStatus = (err as { status?: number } | null | undefined)
            ?.status;
          if (httpStatus === 400) return;
          throw err;
        });
      await this.gdprService.anonymizeUser(requestId);
    } catch (err) {
      // Mark the request FAILED so the SLA monitor can alert and a human
      // can retry via the public cancel/recreate path. Best-effort: a
      // marking failure must not throw past the cron tick.
      await this.prisma.deletionRequest
        .update({
          where: { id: requestId },
          data: { status: 'FAILED' },
        })
        .catch(() => {
          /* swallow */
        });

      console.error(
        `[gdpr-grace-expiry] anonymizeUser failed for request ${requestId}:`,
        err,
      );
    }
  }
}
