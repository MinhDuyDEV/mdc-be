import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PostStatus, ReportStatus } from '@prisma/client';
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
import type { ModerationPolicyService } from './moderation-policy.service';

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

    const existing = await this.prisma.report.findUnique({
      where: {
        unique_active_report: {
          reporterId,
          targetEntity: dto.targetEntity,
          targetId: dto.targetId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('You have already reported this content');
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
    const locked = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM reports
      WHERE id = ${reportId}::uuid
        AND status = 'PENDING'
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;

    if (!locked || locked.length === 0) {
      throw new ConflictException('Report already claimed or not found');
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: { status: ReportStatus.UNDER_REVIEW, assignedToId: moderatorId },
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

      await tx.report.update({
        where: { id: dto.reportId },
        data: {
          status: ReportStatus.RESOLVED_ACTIONED,
          resolvedAt: new Date(),
        },
      });

      if (dto.actionType === 'REMOVE_CONTENT' && dto.targetEntity === 'POST') {
        await tx.post.update({
          where: { id: dto.targetId },
          data: { contentStatus: PostStatus.HIDDEN },
        });
      }

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
}
