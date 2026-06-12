import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../infra/prisma/prisma.service';
import { DeadLetterService } from '../outbox';
import { OutboxService } from '../outbox/outbox.service';
import {
  buildCursorWhere,
  decodeCursor,
  paginateRows,
} from '../common/pagination/cursor';
import type {
  AdminDeadLetterQueryDto,
  AdminUserQueryDto,
  AuditLogQueryDto,
  CreateAdminDto,
  UpdateAdminPermissionsDto,
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
            reason: dto.reason ?? null,
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

  // ---------------------------------------------------------------------------
  // Audit Log Viewer
  // ---------------------------------------------------------------------------

  async listAuditLogs(query: AuditLogQueryDto) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;

    const where: Record<string, unknown> = {
      ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
      ...(cursor ? buildCursorWhere(cursor) : {}),
    };

    const rows = await this.prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            displayName: true,
            profile: {
              select: {
                id: true,
                headline: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
    });

    const { items, nextCursor, hasNextPage } = paginateRows(rows, query.limit);
    return {
      data: items,
      meta: { nextCursor, hasNextPage, limit: query.limit },
    };
  }

  // ---------------------------------------------------------------------------
  // Admin User Management
  // ---------------------------------------------------------------------------

  async createAdmin(adminId: string, dto: CreateAdminDto) {
    return this.prisma.$transaction(async (tx) => {
      // Verify the target user exists
      const user = await tx.user.findUnique({ where: { id: dto.userId } });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Prevent duplicate admin creation
      const existing = await tx.adminUser.findUnique({
        where: { userId: dto.userId },
      });
      if (existing) {
        throw new ConflictException('User is already an admin');
      }

      const adminUser = await tx.adminUser.create({
        data: {
          userId: dto.userId,
          role: 'ADMIN',
          permissions: {
            create: dto.permissions.map((permission) => ({ permission })),
          },
        },
        include: {
          user: {
            select: { id: true, email: true, displayName: true },
          },
          permissions: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          action: 'admin.management.create',
          entityType: 'AdminUser',
          entityId: adminUser.id,
          metadata: { targetUserId: dto.userId, permissions: dto.permissions },
        },
      });

      return adminUser;
    });
  }

  async removeAdmin(adminId: string, targetAdminId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const adminUser = await tx.adminUser.findUnique({
        where: { id: targetAdminId },
      });
      if (!adminUser) {
        throw new NotFoundException('Admin not found');
      }

      // Deleting AdminUser cascades to AdminPermission via Prisma schema onDelete
      await tx.adminUser.delete({ where: { id: targetAdminId } });

      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          action: 'admin.management.remove',
          entityType: 'AdminUser',
          entityId: targetAdminId,
          metadata: { targetUserId: adminUser.userId },
        },
      });
    });
  }

  async updateAdminPermissions(
    adminId: string,
    targetAdminId: string,
    dto: UpdateAdminPermissionsDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const adminUser = await tx.adminUser.findUnique({
        where: { id: targetAdminId },
        include: { permissions: true },
      });
      if (!adminUser) {
        throw new NotFoundException('Admin not found');
      }

      // Replace all permissions atomically
      await tx.adminPermission.deleteMany({
        where: { adminUserId: targetAdminId },
      });
      await tx.adminPermission.createMany({
        data: dto.permissions.map((permission) => ({
          adminUserId: targetAdminId,
          permission,
        })),
      });

      await tx.auditLog.create({
        data: {
          actorUserId: adminId,
          action: 'admin.management.update_permissions',
          entityType: 'AdminUser',
          entityId: targetAdminId,
          metadata: {
            targetUserId: adminUser.userId,
            oldPermissions: adminUser.permissions.map((p) => p.permission),
            newPermissions: dto.permissions,
          },
        },
      });

      // Return refreshed admin with relationships
      return tx.adminUser.findUnique({
        where: { id: targetAdminId },
        include: {
          user: { select: { id: true, email: true, displayName: true } },
          permissions: true,
        },
      });
    });
  }

  async listAdmins() {
    const admins = await this.prisma.adminUser.findMany({
      include: {
        user: {
          select: { id: true, email: true, displayName: true, status: true },
        },
        permissions: {
          select: { permission: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data: admins, meta: { hasNextPage: false, limit: admins.length } };
  }
}
