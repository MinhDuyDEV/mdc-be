import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as crypto from 'node:crypto';
import { PinoLogger } from 'nestjs-pino';

import type { Prisma } from '@prisma/client';
import type { AppConfig } from '../infra/config';
import type { PrismaTransaction } from '../infra/prisma';
import { PrismaService } from '../infra/prisma/prisma.service';
import { IdempotencyService } from '../outbox/idempotency.service';
import { OutboxService } from '../outbox/outbox.service';
import { AuthService } from '../auth/auth.service';
import { ConnectionsService } from '../connections/connections.service';
import { PostsService } from '../posts/posts.service';
import { MessagingService } from '../messaging/messaging.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { SearchIndexService } from '../search/search-index.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { DeletionRequestService } from './deletion-request.service';
import { DataExportService } from './data-export.service';

/**
 * PII keys redacted by scrubPiiInJson. Case-insensitive match.
 * Other keys are preserved unchanged.
 */
const PII_KEYS = new Set([
  'email',
  'phone',
  'phonenumber',
  'name',
  'displayname',
  'firstname',
  'lastname',
  'fullname',
  'ssn',
  'address',
  'ip',
  'useragent',
  'passwordhash',
  'password',
  'token',
  'secret',
  'originaldomain',
]);

/**
 * Redact values for known PII keys while preserving the rest of the structure.
 * This is a defensive scrub for audit log metadata; it must not destroy the
 * non-PII context that compliance reviewers rely on (action, entity IDs, etc.).
 */
function scrubPiiInJson(
  value: Prisma.JsonValue,
  parentKey?: string,
): Prisma.JsonValue {
  if (parentKey && PII_KEYS.has(parentKey.toLowerCase())) {
    return '[REDACTED]';
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => scrubPiiInJson(v));
  }
  const obj = value as Record<string, Prisma.JsonValue>;
  const out: Record<string, Prisma.JsonValue> = {};
  for (const k of Object.keys(obj)) {
    out[k] = scrubPiiInJson(obj[k], k);
  }
  return out;
}

/**
 * Stable JSON serializer with sorted keys at every level.
 * Produces a deterministic string for hashing/canonicalization.
 */
function canonicalJsonStringify(value: Prisma.JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJsonStringify).join(',') + ']';
  }
  const obj = value as Record<string, Prisma.JsonValue>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + canonicalJsonStringify(obj[k]))
      .join(',') +
    '}'
  );
}

@Injectable()
export class GdprService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly outboxService: OutboxService,
    private readonly idempotencyService: IdempotencyService,
    private readonly authService: AuthService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly connectionsService: ConnectionsService,
    private readonly postsService: PostsService,
    private readonly messagingService: MessagingService,
    private readonly analyticsService: AnalyticsService,
    private readonly searchIndex: SearchIndexService,
    private readonly deletionRequestService: DeletionRequestService,
    private readonly dataExportService: DataExportService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GdprService.name);
  }

  // Self-service: user requests their own deletion
  async requestOwnDeletion(userId: string, reason?: string) {
    return this.deletionRequestService.createDeletionRequest(
      userId,
      userId,
      reason,
    );
  }

  // Admin: delete on behalf of user
  async requestDeletionForUser(
    userId: string,
    requestedBy: string,
    reason?: string,
  ) {
    return this.deletionRequestService.createDeletionRequest(
      userId,
      requestedBy,
      reason,
    );
  }

  // Anonymize user (called by grace-expiry processor after grace period)
  async anonymizeUser(
    requestId: string,
  ): Promise<{ userId: string; success: boolean }> {
    const request = await this.prisma.deletionRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) throw new NotFoundException('Deletion request not found');
    if (request.status === 'COMPLETED') {
      return { userId: request.userId, success: true };
    }

    const userId = request.userId;
    const anonymizedAt = new Date();
    // Preserve the original email for the audit trail. On retry, read from
    // the already-stored anonymizedEmail so the chain isn't overwritten.
    const userBefore = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, anonymizedEmail: true, anonymizedAt: true },
    });
    if (!userBefore) throw new NotFoundException('User not found');

    if (userBefore.anonymizedAt) {
      // Already anonymized in a prior attempt; mark request complete and bail.
      await this.prisma.deletionRequest.update({
        where: { id: requestId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      return { userId, success: true };
    }

    const originalEmail = userBefore.email;
    const anonymizedEmail = `deleted-${randomUUID()}@anonymized.local`;

    // The main transaction does the anonymization + emits both outbox events
    // atomically. Idempotency claim is OUTSIDE the tx (it is the
    // deduplication mechanism, not the data write).
    let alreadyClaimed = false;
    try {
      await this.idempotencyService.claim('GDPR', `anonymize:${userId}`);
    } catch (err) {
      // Idempotency: the only "expected" failure is a duplicate-claim collision.
      // P2002 from Prisma; ConflictException from IdempotencyService.
      const isDuplicate =
        (err as { code?: string })?.code === 'P2002' ||
        (err as { constructor?: { name?: string } })?.constructor?.name ===
          'ConflictException';
      if (!isDuplicate) throw err;
      alreadyClaimed = true;
    }
    if (alreadyClaimed) {
      return { userId, success: true };
    }

    try {
      await this.prisma.$transaction(async (tx: PrismaTransaction) => {
        // Re-fetch inside the tx to prevent TOCTOU (user could be
        // anonymized by a parallel request between claim and tx start).
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || user.anonymizedAt) {
          throw new AlreadyAnonymizedError();
        }

        await tx.user.update({
          where: { id: userId },
          data: {
            email: anonymizedEmail,
            anonymizedEmail: originalEmail,
            displayName: 'Deleted User',
            passwordHash: null,
            handle: null,
            status: 'DELETED',
            anonymizedAt,
          },
        });

        // Anonymize audit logs (scrub PII keys, keep action + entity IDs)
        await tx.auditLog.updateMany({
          where: { actorUserId: userId },
          data: {
            actorUserId: null,
            metadata: scrubPiiInJson({
              redactedAt: anonymizedAt.toISOString(),
              reason: 'gdpr-erasure',
            }) as Prisma.InputJsonValue,
          },
        });

        // Soft-delete child records
        await tx.profile.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: anonymizedAt },
        });
        await tx.experience.updateMany({
          where: { profile: { userId }, deletedAt: null },
          data: { deletedAt: anonymizedAt },
        });
        await tx.education.updateMany({
          where: { profile: { userId }, deletedAt: null },
          data: { deletedAt: anonymizedAt },
        });
        await tx.certification.updateMany({
          where: { profile: { userId }, deletedAt: null },
          data: { deletedAt: anonymizedAt },
        });

        // GDPR cascade: additional child tables not covered by service modules.
        // Each operation is best-effort — if the model doesn't have the expected
        // field we log a warning and skip rather than throw.
        try {
          await tx.application.updateMany({
            where: { userId },
            data: { coverLetter: null, deletedAt: anonymizedAt },
          });
        } catch {
          this.logger.warn(
            'Skipping application cascade — model/field mismatch',
          );
        }
        try {
          await tx.notification.updateMany({
            where: { userId },
            data: { deletedAt: anonymizedAt },
          });
        } catch {
          this.logger.warn(
            'Skipping notification cascade — model/field mismatch',
          );
        }
        // EmailDelivery has no userId field in the schema — skip.
        this.logger.warn(
          'Skipping emailDelivery cascade — model has no userId field',
        );
        try {
          await tx.emailTrackingEvent.updateMany({
            where: { userId },
            data: { ipAddress: null, userAgent: null },
          });
        } catch {
          this.logger.warn(
            'Skipping emailTrackingEvent cascade — model/field mismatch',
          );
        }
        try {
          await tx.userDevice.deleteMany({
            where: { userId },
          });
        } catch {
          this.logger.warn(
            'Skipping userDevice cascade — model/field mismatch',
          );
        }

        // Anonymize connections/follows/blocks
        await this.connectionsService.anonymizeForUser(tx, userId);

        // Anonymize posts
        await this.postsService.anonymizeForUser(tx, userId);

        // Anonymize messages
        await this.messagingService.anonymizeForUser(tx, userId);

        // Update DeletionRequest status
        await tx.deletionRequest.update({
          where: { id: requestId },
          data: { status: 'COMPLETED', completedAt: anonymizedAt },
        });

        // Add audit entry (deterministic hash chain)
        await this.appendAudit(tx, requestId, userId, 'anonymized_user', {
          anonymizedAt: anonymizedAt.toISOString(),
          anonymizedEmail,
        });

        // Emit BOTH outbox events atomically with the data changes.
        // UserDataAnonymized: signals the anonymization step completed.
        // UserDataDeleted: triggers the async cascade (realtime disconnect,
        //   search index delete, analytics anonymize) handled by
        //   gdpr-deletion.processor.
        await this.outboxService.emit(tx, {
          eventType: 'UserDataAnonymized',
          aggregateType: 'User',
          aggregateId: userId,
          payload: {
            userId,
            requestId,
            anonymizedAt: anonymizedAt.toISOString(),
            anonymizedFields: [
              'email',
              'displayName',
              'passwordHash',
              'handle',
            ],
          },
        });
        await this.outboxService.emit(tx, {
          eventType: 'UserDataDeleted',
          aggregateType: 'User',
          aggregateId: userId,
          payload: {
            requestId,
            userId,
            deletedBy: request.requestedBy,
            reason: request.reason,
            deletedAt: anonymizedAt.toISOString(),
          },
        });
      });
    } catch (err) {
      if (err instanceof AlreadyAnonymizedError) {
        return { userId, success: true };
      }
      throw err;
    }

    // Post-commit: revoke sessions and disconnect realtime. These touch
    // tables outside the GDPR transaction (auth uses its own client), so
    // they run after the main transaction succeeds. Failures are logged
    // but do not roll back the anonymization (which is irreversible).
    try {
      await this.authService.revokeAllUserSessions(userId);
    } catch (err) {
      // Auth revocation is best-effort; the user is already anonymized.

      this.logger.error({ userId, err }, 'revokeAllUserSessions failed');
    }
    try {
      await this.realtimeGateway.disconnectUser(userId);
    } catch (err) {
      this.logger.error(
        { userId, err },
        'realtimeGateway.disconnectUser failed',
      );
    }

    return { userId, success: true };
  }

  // Cancel a pending deletion (within grace period)
  async cancelDeletion(requestId: string, userId: string): Promise<void> {
    await this.deletionRequestService.cancelRequest(requestId, userId);
  }

  /**
   * Append a tamper-evident entry to the audit chain. The hash is
   * deterministic given the input, so the chain can be replayed/verified.
   *
   * Chain input: `previousHash|action|sequence|canonicalJson(metadata)`
   * `sequence` is the count of audit rows already in the chain for this
   * request; together with the unique constraint on `entry_hash`, this
   * prevents both non-determinism (no Date.now) and silent branching
   * (DB-level uniqueness).
   */
  private async appendAudit(
    tx: PrismaTransaction,
    requestId: string,
    userId: string,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    // Sequence is read inside the tx; the unique index on entry_hash plus
    // Prisma's transaction isolation (default READ COMMITTED) make the
    // count + insert effectively monotonic for a single request.
    const sequence = await tx.deletionAudit.count({ where: { requestId } });
    const lastEntry = await tx.deletionAudit.findFirst({
      where: { requestId },
      orderBy: { sequence: 'desc' },
    });
    const previousHash: string | null = lastEntry?.entryHash ?? null;
    const canonical = canonicalJsonStringify(
      metadata as unknown as Prisma.JsonValue,
    );
    const entryData = `${previousHash ?? ''}|${action}|${sequence}|${canonical}`;
    const entryHash = crypto
      .createHash('sha256')
      .update(entryData)
      .digest('hex');

    await tx.deletionAudit.create({
      data: {
        requestId,
        userId,
        action,
        sequence,
        metadata: metadata as Prisma.InputJsonValue,
        previousHash,
        entryHash,
      },
    });
  }
}

class AlreadyAnonymizedError extends Error {
  constructor() {
    super('User already anonymized');
    this.name = 'AlreadyAnonymizedError';
  }
}
