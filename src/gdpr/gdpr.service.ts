import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as crypto from 'node:crypto';

import type { Prisma } from '@prisma/client';
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

@Injectable()
export class GdprService {
  constructor(
    private readonly prisma: PrismaService,
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
  ) {}

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

  // Anonymize user (called by processor after grace period or by user cancel)
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

    // Idempotency: prevent double-anonymization
    try {
      await this.idempotencyService.claim('GDPR', `anonymize:${userId}`);
    } catch {
      return { userId, success: true };
    }

    const anonymizedAt = new Date();
    const anonymizedEmail = `deleted-${randomUUID()}@anonymized.local`;

    await this.prisma.$transaction(async (tx: PrismaTransaction) => {
      // Store original email before anonymizing (for audit)
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail,
          anonymizedEmail: user.email,
          displayName: 'Deleted User',
          passwordHash: null,
          handle: null,
          status: 'DELETED',
          anonymizedAt,
        },
      });

      // Anonymize audit logs
      await tx.auditLog.updateMany({
        where: { actorUserId: userId },
        data: {
          actorUserId: null,
          metadata: this.scrubPii(user.email),
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

      // Anonymize connections/follows/blocks
      await this.connectionsService.anonymizeForUser(tx, userId);

      // Anonymize posts
      await this.postsService.anonymizeForUser(tx, userId);

      // Anonymize messages
      await this.messagingService.anonymizeForUser(tx, userId);

      // Revoke all sessions
      await this.authService.revokeAllUserSessions(userId);

      // Update DeletionRequest status
      await tx.deletionRequest.update({
        where: { id: requestId },
        data: { status: 'COMPLETED', completedAt: anonymizedAt },
      });

      // Add audit entry
      await this.appendAudit(tx, requestId, userId, 'anonymized_user', {
        anonymizedAt,
        anonymizedEmail,
      });

      // Emit outbox event for async cascade
      await this.outboxService.emit(tx, {
        eventType: 'UserDataAnonymized',
        aggregateType: 'User',
        aggregateId: userId,
        payload: {
          userId,
          requestId,
          anonymizedAt: anonymizedAt.toISOString(),
          anonymizedFields: ['email', 'displayName', 'passwordHash', 'handle'],
        },
      });
    });

    // After transaction: emit cascade events for non-transactional operations
    await this.prisma.$transaction(async (tx) => {
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

    return { userId, success: true };
  }

  // Cancel a pending deletion (within grace period)
  async cancelDeletion(requestId: string, userId: string): Promise<void> {
    await this.deletionRequestService.cancelRequest(requestId, userId);
  }

  private scrubPii(email: string): Prisma.InputJsonValue {
    return {
      PII_REDACTED: true,
      originalDomain: email.split('@')[1],
    };
  }

  private async appendAudit(
    tx: PrismaTransaction,
    requestId: string,
    userId: string,
    action: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const lastEntry = await tx.deletionAudit.findFirst({
      where: { requestId },
      orderBy: { createdAt: 'desc' },
    });
    const previousHash: string | null = lastEntry?.entryHash ?? null;
    const entryData = `${previousHash ?? ''}|${action}|${JSON.stringify(metadata)}|${Date.now()}`;
    const entryHash = crypto
      .createHash('sha256')
      .update(entryData)
      .digest('hex');

    await tx.deletionAudit.create({
      data: {
        requestId,
        userId,
        action,
        metadata: metadata as Prisma.InputJsonValue,
        previousHash,
        entryHash,
      },
    });
  }
}
