import { Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { DeadLetterService } from '../outbox';
import { OutboxService } from '../outbox/outbox.service';
import type {
  AdminDeadLetterQueryDto,
  AdminUserQueryDto,
  UpdateUserStatusDto,
  VerifyCompanyDto,
} from './dto';
import { assertValidUserStatusTransition } from './user-status.machine';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly deadLetter: DeadLetterService,
    private readonly outboxService: OutboxService,
  ) {}

  async listUsers(query: AdminUserQueryDto) {
    const users = await this.prisma.user.findMany({
      where: {
        status: query.status,
        OR: query.search
          ? [
              { email: { contains: query.search, mode: 'insensitive' } },
              { displayName: { contains: query.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    return { data: users, meta: { hasNextPage: users.length === 50 } };
  }

  async updateUserStatus(
    userId: string,
    dto: UpdateUserStatusDto,
    adminId: string,
  ): Promise<void> {
    // fallow-ignore-next-line complexity
    await this.prisma.$transaction(async (tx) => {
      // Read current status so we can validate the transition and
      // record previousStatus for downstream consumers / auditors.
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });
      if (!current) {
        throw new NotFoundException('User not found');
      }

      // No-op short-circuit: same-status updates write nothing and
      // emit no event (avoids noisy "transition ACTIVE → ACTIVE"
      // audit / outbox spam from repeated admin clicks).
      if (current.status === dto.status) {
        return;
      }

      // Validate the transition against the state machine.
      // Throws BadRequestException for any disallowed edge.
      assertValidUserStatusTransition(current.status, dto.status);

      await tx.user.update({
        where: { id: userId },
        data: { status: dto.status },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          action: 'admin.user.status_change',
          entityType: 'User',
          entityId: userId,
          metadata: {
            previousStatus: current.status,
            newStatus: dto.status,
            reason: dto.reason,
          },
        },
      });

      if (dto.status === UserStatus.SUSPENDED) {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      // Emit domain event so downstream consumers (analytics, audit
      // pipeline, notification fan-out) can react to status changes.
      // Note: UserStatus.DELETED can be reached from any status, so
      // we emit in the same transaction as the user update.
      await this.outboxService.emit(tx, {
        eventType: 'UserStatusChanged',
        aggregateType: 'User',
        aggregateId: userId,
        payload: {
          userId,
          previousStatus: current.status,
          newStatus: dto.status,
          changedBy: adminId,
          reason: dto.reason ?? null,
        },
      });
    });
  }

  async listCompanies(query: { search?: string }) {
    const companies = await this.prisma.company.findMany({
      where: query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : undefined,
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    return { data: companies, meta: { hasNextPage: companies.length === 50 } };
  }

  async verifyCompany(
    companyId: string,
    dto: VerifyCompanyDto,
    adminId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Upsert verification record (one per company due to @@unique)
      await tx.companyVerification.upsert({
        where: { companyId },
        create: {
          companyId,
          requestedByUserId: adminId,
          status: 'VERIFIED',
          reviewedByUserId: adminId,
          reviewedAt: new Date(),
          notes: dto.notes,
          documentUrls: [],
        },
        update: {
          status: 'VERIFIED',
          reviewedByUserId: adminId,
          reviewedAt: new Date(),
          notes: dto.notes,
        },
      });

      // Keep company.verified/verifiedAt in sync with product read paths
      await tx.company.update({
        where: { id: companyId },
        data: {
          verified: true,
          verifiedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          action: 'admin.company.verify',
          entityType: 'Company',
          entityId: companyId,
          metadata: { notes: dto.notes },
        },
      });
    });
  }

  async listJobs(query: { companyId?: string }) {
    const jobs = await this.prisma.job.findMany({
      where: query.companyId ? { companyId: query.companyId } : undefined,
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    return { data: jobs, meta: { hasNextPage: jobs.length === 50 } };
  }

  async listDeadLetters(query: AdminDeadLetterQueryDto) {
    const rows = await this.prisma.outboxDeadLetter.findMany({
      where: query.eventType ? { eventType: query.eventType } : undefined,
      take: 51,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
      orderBy: { failedAt: 'desc' },
    });
    const data = rows.slice(0, 50);
    return {
      data,
      meta: {
        hasNextPage: rows.length > 50,
        endCursor: data.at(-1)?.id ?? null,
      },
    };
  }

  async replayDeadLetter(deadLetterId: string, adminId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.deadLetter.replay(tx, deadLetterId);
      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          action: 'admin.outbox.dead_letter.replay',
          entityType: 'OutboxDeadLetter',
          entityId: deadLetterId,
          metadata: {},
        },
      });
    });
  }
}
