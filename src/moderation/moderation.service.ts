import {
  ConflictException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { PostStatus, ReportStatus, UserStatus } from '@prisma/client';
import type {
  PrismaService,
  PrismaTransaction,
} from '../infra/prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import type {
  CreateModerationActionDto,
  CreateReportDto,
  ReportResponseDto,
} from './dto';
import { ModerationPolicyService } from './moderation-policy.service';

@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly policy: ModerationPolicyService,
  ) {}

  async createReport(
    dto: CreateReportDto,
    reporterId: string,
  ): Promise<ReportResponseDto> {
    const targetExists = await this.policy.validateTargetExists(
      dto.targetEntity,
      dto.targetId,
    );
    if (!targetExists) {
      throw new NotFoundException('Reported content not found');
    }

    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetEntity: dto.targetEntity,
        targetId: dto.targetId,
        status: { in: [ReportStatus.PENDING, ReportStatus.UNDER_REVIEW] },
      },
    });

    if (existing) {
      throw new ConflictException(
        'You have already reported this content and it is still under review',
      );
    }

    return this.prisma.$transaction(async (tx: PrismaTransaction) => {
      const report = await tx.report.create({
        data: {
          reporterId,
          targetEntity: dto.targetEntity,
          targetId: dto.targetId,
          category: dto.category,
          description: dto.description,
          priority: dto.category === 'SPAM' ? 2 : 1,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: reporterId,
          action: 'report.create',
          entityType: 'Report',
          entityId: report.id,
          metadata: { targetEntity: dto.targetEntity, targetId: dto.targetId },
        },
      });

      await this.outbox.emit(tx, {
        eventType: 'ReportCreated',
        aggregateType: 'Report',
        aggregateId: report.id,
        payload: {
          reportId: report.id,
          targetEntity: dto.targetEntity,
          targetId: dto.targetId,
        },
      });

      return report;
    });
  }

  async claimReport(
    reportId: string,
    moderatorId: string,
  ): Promise<ReportResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM reports
        WHERE id = ${reportId}::uuid
          AND status = 'PENDING'
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `;

      if (!locked || locked.length === 0) {
        throw new ConflictException('Report already claimed or not found');
      }

      return tx.report.update({
        where: { id: reportId },
        data: { status: ReportStatus.UNDER_REVIEW, assignedToId: moderatorId },
      });
    });
  }

  async listReports(status?: ReportStatus): Promise<ReportResponseDto[]> {
    return this.prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });
  }

  async applyModerationAction(
    dto: CreateModerationActionDto,
    moderatorId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: PrismaTransaction) => {
      // Validate that the report exists and matches the target
      const report = await tx.report.findUnique({
        where: { id: dto.reportId },
      });
      if (!report) {
        throw new NotFoundException('Report not found');
      }
      if (
        report.targetEntity !== dto.targetEntity ||
        report.targetId !== dto.targetId
      ) {
        throw new ConflictException(
          'Action target does not match report target',
        );
      }

      await tx.moderationAction.create({
        data: {
          reportId: dto.reportId,
          moderatorId,
          actionType: dto.actionType,
          targetEntity: dto.targetEntity,
          targetId: dto.targetId,
          reason: dto.reason,
          durationHours: dto.durationHours,
          expiresAt: dto.durationHours
            ? new Date(Date.now() + dto.durationHours * 3600000)
            : null,
        },
      });

      // Apply content/side-effect actions based on actionType
      let reportStatus: ReportStatus;
      switch (dto.actionType) {
        case 'REMOVE_CONTENT':
          await this.applyContentRemoval(tx, dto.targetEntity, dto.targetId);
          reportStatus = ReportStatus.RESOLVED_ACTIONED;
          break;
        case 'SUSPEND_USER':
        case 'BAN_USER':
          reportStatus = ReportStatus.RESOLVED_ACTIONED;
          await this.applyUserSuspension(
            tx,
            await this.resolveTargetUser(tx, dto.targetEntity, dto.targetId),
          );
          break;
        case 'WARN':
          reportStatus = ReportStatus.RESOLVED_ACTIONED;
          break;
        case 'DISMISS':
          reportStatus = ReportStatus.RESOLVED_DISMISSED;
          break;
        default:
          throw new NotImplementedException(
            `Action type ${dto.actionType as string} is not implemented`,
          );
      }

      await tx.report.update({
        where: { id: dto.reportId },
        data: {
          status: reportStatus,
          resolvedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: moderatorId,
          action: 'moderation.action',
          entityType: 'ModerationAction',
          entityId: dto.reportId,
          metadata: {
            actionType: dto.actionType,
            targetEntity: dto.targetEntity,
          },
        },
      });
    });
  }

  private async applyContentRemoval(
    tx: PrismaTransaction,
    targetEntity: string,
    targetId: string,
  ): Promise<void> {
    switch (targetEntity) {
      case 'POST':
        await tx.post.update({
          where: { id: targetId },
          data: { contentStatus: PostStatus.REMOVED_BY_MODERATOR },
        });
        break;
      case 'COMMENT':
        await tx.comment.update({
          where: { id: targetId },
          data: { contentStatus: 'HIDDEN' },
        });
        break;
      case 'JOB':
        await tx.job.update({
          where: { id: targetId },
          data: { contentStatus: 'HIDDEN' },
        });
        break;
      case 'PROFILE':
      case 'COMPANY':
      case 'MESSAGE':
        // These entities don't have contentStatus — log for future implementation
        break;
      default:
        throw new NotImplementedException(
          `Content removal not supported for entity type ${targetEntity}`,
        );
    }
  }

  private async resolveTargetUser(
    tx: PrismaTransaction,
    targetEntity: string,
    targetId: string,
  ): Promise<string> {
    switch (targetEntity) {
      case 'POST': {
        const post = await tx.post.findUnique({
          where: { id: targetId },
          select: { authorId: true },
        });
        if (!post)
          throw new NotFoundException('Post not found for user resolution');
        return post.authorId;
      }
      case 'COMMENT': {
        const comment = await tx.comment.findUnique({
          where: { id: targetId },
          select: { authorId: true },
        });
        if (!comment)
          throw new NotFoundException('Comment not found for user resolution');
        return comment.authorId;
      }
      case 'MESSAGE': {
        const message = await tx.message.findUnique({
          where: { id: targetId },
          select: { senderId: true },
        });
        if (!message)
          throw new NotFoundException('Message not found for user resolution');
        return message.senderId;
      }
      case 'PROFILE': {
        const profile = await tx.profile.findUnique({
          where: { id: targetId },
          select: { userId: true },
        });
        if (!profile)
          throw new NotFoundException('Profile not found for user resolution');
        return profile.userId;
      }
      case 'COMPANY':
      case 'JOB':
        throw new NotImplementedException(
          `User suspension/ban for ${targetEntity} targets is not yet implemented. ` +
            'Use REMOVE_CONTENT to hide the content instead.',
        );
      default:
        throw new NotImplementedException(
          `Cannot resolve user for entity type ${targetEntity}`,
        );
    }
  }

  private async applyUserSuspension(
    tx: PrismaTransaction,
    targetUserId: string,
  ): Promise<void> {
    await tx.user.update({
      where: { id: targetUserId },
      data: { status: UserStatus.SUSPENDED },
    });

    await tx.refreshToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
